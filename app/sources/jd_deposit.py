from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.models import PriceBar, PriceTick
from app.sources.base import HttpClient, SourceError


class _JdDepositGoldAdapter:
    def __init__(self, *, name: str, endpoint: str, client: HttpClient | None = None) -> None:
        self.name = name
        self.endpoint = endpoint
        self.symbol = "AUCN"
        self.market = "domestic"
        self.currency = "CNY"
        self.unit = "g"
        self.client = client or HttpClient()

    @staticmethod
    def _first_present(payload: dict[str, Any], paths: list[tuple[str, ...]]) -> Any:
        for path in paths:
            node: Any = payload
            ok = True
            for key in path:
                if not isinstance(node, dict) or key not in node:
                    ok = False
                    break
                node = node[key]
            if ok and node is not None and not (isinstance(node, str) and not node.strip()):
                return node
        return None

    @staticmethod
    def _parse_timestamp(value: Any) -> datetime:
        if isinstance(value, (int, float)):
            epoch = float(value)
            if epoch > 1_000_000_000_000:
                epoch /= 1000.0
            return datetime.fromtimestamp(epoch, tz=timezone.utc)

        text = str(value or "").strip()
        if not text:
            return datetime.now(tz=timezone.utc)

        if text.isdigit():
            epoch = float(text)
            if epoch > 1_000_000_000_000:
                epoch /= 1000.0
            return datetime.fromtimestamp(epoch, tz=timezone.utc)

        normalized = text.replace("/", "-")
        if normalized.endswith("Z"):
            normalized = f"{normalized[:-1]}+00:00"
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError:
            for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
                try:
                    parsed = datetime.strptime(normalized, fmt)
                    break
                except ValueError:
                    continue
            else:
                return datetime.now(tz=timezone.utc)

        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)

    def fetch_realtime(self) -> PriceTick:
        payload = self.client.get_json(self.endpoint)
        if not isinstance(payload, dict):
            raise SourceError(f"{self.name} returned non-object payload")

        price_raw = self._first_present(
            payload,
            [
                ("resultData", "datas", "price"),
                ("resultData", "price"),
                ("data", "price"),
                ("price",),
            ],
        )
        if price_raw is None:
            raise SourceError(f"{self.name} payload missing price field")

        try:
            price = float(str(price_raw).replace(",", "").strip())
        except (TypeError, ValueError) as exc:
            raise SourceError(f"{self.name} invalid price: {price_raw}") from exc

        ts_raw = self._first_present(
            payload,
            [
                ("resultData", "datas", "timestamp"),
                ("resultData", "datas", "ts"),
                ("resultData", "datas", "time"),
                ("resultData", "datas", "updateTime"),
                ("resultData", "datas", "quoteTime"),
                ("resultData", "timestamp"),
                ("resultData", "time"),
                ("timestamp",),
                ("time",),
            ],
        )

        return PriceTick(
            symbol=self.symbol,
            market=self.market,
            price=price,
            currency=self.currency,
            unit=self.unit,
            timestamp=self._parse_timestamp(ts_raw),
            source=self.name,
        )

    def fetch_history(self, start: datetime, end: datetime, interval: str = "1d") -> list[PriceBar]:
        # These endpoints are realtime-focused. Let downstream fallback sources provide history bars.
        _ = (start, end, interval)
        return []


class JdMinshengDepositGoldAdapter(_JdDepositGoldAdapter):
    def __init__(self, client: HttpClient | None = None) -> None:
        super().__init__(
            name="jdjygold_minsheng_aucn",
            endpoint="https://api.jdjygold.com/gw/generic/hj/h5/m/latestPrice?reqData={}",
            client=client,
        )


class JdZheshangDepositGoldAdapter(_JdDepositGoldAdapter):
    def __init__(self, client: HttpClient | None = None) -> None:
        super().__init__(
            name="jdjygold_zheshang_aucn",
            endpoint="https://api.jdjygold.com/gw2/generic/jrm/h5/m/stdLatestPrice?productSku=1961543816",
            client=client,
        )
