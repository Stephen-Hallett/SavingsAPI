import functools
from collections.abc import Callable


def handle_missing(func: Callable) -> Callable:
    @functools.wraps(func)
    def wrapper(*args: object, **kwargs: object) -> object:
        try:
            print(value := func(*args, **kwargs))  # Call the original function
            return value
        except (ValueError, KeyError) as e:
            print(e)
            return 0

    return wrapper
