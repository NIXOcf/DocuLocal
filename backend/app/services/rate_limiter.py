"""Limitador de frecuencia de ventana deslizante, en memoria y seguro entre hilos."""
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
        self._events: dict[Hashable, deque[float]] = {}
        self._lock = threading.Lock()

    def _prune(self, key: Hashable, now: float) -> deque[float]:
        q = self._events.get(key)
        if q is None:
            return deque()
        while q and q[0] <= now - self.window:
            q.popleft()
        if not q:
            del self._events[key]
            return deque()
        return q

    def retry_after(self, key: Hashable) -> int:
        """Segundos que faltan para poder reintentar; 0 si la clave no está bloqueada."""
        with self._lock:
            now = self._clock()
            q = self._prune(key, now)
            if len(q) < self.max_events:
                return 0
            return max(1, math.ceil(q[0] + self.window - now))

    def add(self, key: Hashable) -> None:
        with self._lock:
            now = self._clock()
            if len(self._events) > _SWEEP_AT:
                for k in list(self._events):
                    self._prune(k, now)
            self._events.setdefault(key, deque()).append(now)

    def consume(self, key: Hashable) -> int:
        """Registra un evento si hay cupo y devuelve 0; si no, devuelve los segundos de espera sin registrar."""
        wait = self.retry_after(key)
        if wait == 0:
            self.add(key)
        return wait

    def reset(self, key: Hashable) -> None:
        with self._lock:
            self._events.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._events.clear()
