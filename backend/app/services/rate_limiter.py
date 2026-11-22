"""Limitador de frecuencia de ventana deslizante, en memoria y seguro entre hilos."""
import itertools
import math
import threading
import time
from collections import deque
from typing import Callable, Hashable

# shortcut: el estado vive en la memoria de un solo proceso (se pierde al reiniciar y no se comparte entre
# instancias), mejorar con Redis cuando haya más de una instancia de la API.
_SWEEP_AT = 10_000  # claves a partir de las cuales se purgan las vencidas


class SlidingWindowLimiter:
    def __init__(self, max_events: int, window_seconds: float, clock: Callable[[], float] = time.monotonic):
        self.max_events = max_events
        self.window = window_seconds
        self._clock = clock
        self._events: dict[Hashable, deque[tuple[float, int]]] = {}  # (instante, token)
        self._tokens = itertools.count()
        self._lock = threading.Lock()

    def _prune(self, key: Hashable, now: float) -> deque:
        q = self._events.get(key)
        if q is None:
            return deque()
        while q and q[0][0] <= now - self.window:
            q.popleft()
        if not q:
            del self._events[key]
            return deque()
        return q

    def _wait(self, q: deque, now: float) -> int:
        return 0 if len(q) < self.max_events else max(1, math.ceil(q[0][0] + self.window - now))

    def retry_after(self, key: Hashable) -> int:
        """Segundos que faltan para poder reintentar; 0 si la clave no está bloqueada."""
        with self._lock:
            now = self._clock()
            return self._wait(self._prune(key, now), now)

    def count(self, key: Hashable) -> int:
        with self._lock:
            return len(self._prune(key, self._clock()))

    def try_acquire(self, key: Hashable) -> tuple[int, int | None]:
        """Comprueba y registra un intento en un solo paso atómico.

        Devuelve (0, token) si había cupo (el intento queda registrado; el token sirve para `release`) o
        (segundos de espera, None) si no, sin registrar.
        """
        with self._lock:
            now = self._clock()
            if len(self._events) > _SWEEP_AT:
                for k in list(self._events):
                    self._prune(k, now)
            q = self._prune(key, now)
            wait = self._wait(q, now)
            if wait:
                return wait, None
            token = next(self._tokens)
            self._events.setdefault(key, deque()).append((now, token))
            return 0, token

    def release(self, key: Hashable, token: int | None) -> None:
        """Descarta exactamente el intento reservado con `token` (no el último de otra petición)."""
        with self._lock:
            q = self._events.get(key)
            if q is None or token is None:
                return
            for i, (_, t) in enumerate(q):
                if t == token:
                    del q[i]
                    break
            if not q:
                del self._events[key]

    def reset(self, key: Hashable) -> None:
        with self._lock:
            self._events.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._events.clear()
