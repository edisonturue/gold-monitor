from __future__ import annotations

import json
import ssl
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.config import settings


class SourceError(RuntimeError):
    pass


@dataclass(slots=True)
class HttpClient:
    timeout: int = settings.request_timeout_sec
    default_headers: dict[str, str] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.default_headers:
            self.default_headers = {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
                "Accept": "application/json,text/plain,*/*",
            }

    def _headers(self, headers: dict[str, str] | None) -> dict[str, str]:
        return {**self.default_headers, **(headers or {})}

    def get_json(self, url: str, headers: dict[str, str] | None = None) -> Any:
        request = Request(url=url, method="GET", headers=self._headers(headers))
        try:
            with urlopen(request, timeout=self.timeout, context=ssl.create_default_context()) as response:
                body = response.read().decode("utf-8")
                return json.loads(body)
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise SourceError(f"GET {url} failed: {exc}") from exc

    def get_text(self, url: str, headers: dict[str, str] | None = None) -> str:
        request = Request(url=url, method="GET", headers=self._headers(headers))
        try:
            with urlopen(request, timeout=self.timeout, context=ssl.create_default_context()) as response:
                return response.read().decode("utf-8")
        except (HTTPError, URLError, TimeoutError) as exc:
            raise SourceError(f"GET {url} failed: {exc}") from exc

    def post_json(self, url: str, payload: dict[str, Any], headers: dict[str, str] | None = None) -> dict[str, Any] | str:
        body = json.dumps(payload).encode("utf-8")
        request_headers = {"Content-Type": "application/json", **self._headers(headers)}
        request = Request(url=url, data=body, method="POST", headers=request_headers)
        try:
            with urlopen(request, timeout=self.timeout, context=ssl.create_default_context()) as response:
                response_body = response.read().decode("utf-8")
                if not response_body:
                    return {}
                try:
                    return json.loads(response_body)
                except json.JSONDecodeError:
                    return response_body
        except (HTTPError, URLError, TimeoutError) as exc:
            raise SourceError(f"POST {url} failed: {exc}") from exc


def parse_epoch_to_datetime(epoch: int | float) -> datetime:
    return datetime.fromtimestamp(epoch, tz=datetime.now().astimezone().tzinfo).astimezone()
