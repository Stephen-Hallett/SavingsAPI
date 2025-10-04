import functools
from collections.abc import Callable


def handle_missing(func: Callable) -> Callable:
    @functools.wraps(func)
    def wrapper(*args: object, **kwargs: object) -> object:
        try:
            return func(*args, **kwargs)  # Call the original function
        except (ValueError, KeyError):
            return 0
    return wrapper
