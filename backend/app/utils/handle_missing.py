import functools
from collections.abc import Callable

from fastapi import HTTPException


def handle_missing(func: Callable) -> Callable:
    @functools.wraps(func)
    def wrapper(*args: object, **kwargs: object) -> object:
        try:
            print(value := func(*args, **kwargs))  # Call the original function
            return value
        except (ValueError, KeyError) as e:
            raise HTTPException(
                status_code=500, detail=f"Error occurred calling {func.__name__}"
            ) from e

    return wrapper
