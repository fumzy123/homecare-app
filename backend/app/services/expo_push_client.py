"""Expo HTTP boundary. Return safe codes, never log provider payloads/tokens."""
from dataclasses import dataclass
import httpx


@dataclass(frozen=True)
class PushResult:
    status: str
    ticket_id: str | None = None
    code: str | None = None


class ExpoPushClient:
    def __init__(self, access_token='', client=None):
        self.client = client or httpx.Client(timeout=10)
        self.headers = {'Accept': 'application/json'}
        if access_token:
            self.headers['Authorization'] = f'Bearer {access_token}'

    def close(self):
        self.client.close()

    def _request(self, endpoint, payload):
        try:
            response = self.client.post('https://exp.host/--/api/v2/push/' + endpoint,
                                        json=payload, headers=self.headers)
            if response.status_code == 429 or response.status_code >= 500:
                return PushResult('retry', code='provider_unavailable')
            if response.status_code != 200:
                return PushResult('failed', code='provider_http_error')
            result = response.json()
            if not isinstance(result, dict) or result.get('errors'):
                return PushResult('retry', code='provider_response_error')
            return result.get('data')
        except (httpx.HTTPError, ValueError):
            return PushResult('retry', code='provider_unavailable')

    @staticmethod
    def _parse(result, receipt=False):
        if not isinstance(result, dict):
            return PushResult('retry', code='invalid_response')
        if result.get('status') == 'ok':
            if receipt:
                return PushResult('delivered')  # Accepted by FCM, not proof of phone display.
            ticket = result.get('id')
            if isinstance(ticket, str) and 0 < len(ticket) <= 100:
                return PushResult('receipt', ticket_id=ticket)
        if result.get('status') == 'error':
            details = result.get('details') or {}
            code = details.get('error') if isinstance(details, dict) else None
            if code in {'DeviceNotRegistered', 'MessageTooBig', 'MismatchSenderId', 'InvalidCredentials'}:
                return PushResult('failed', code=code)
            return PushResult('retry', code='provider_rejected')
        return PushResult('retry', code='invalid_response')

    def send(self, message):
        data = self._request('send', [message])
        if isinstance(data, PushResult):
            return data
        return self._parse(data[0] if isinstance(data, list) and len(data) == 1 else None)

    def receipt(self, ticket_id):
        data = self._request('getReceipts', {'ids': [ticket_id]})
        if isinstance(data, PushResult):
            return data
        if isinstance(data, dict) and ticket_id not in data:
            return PushResult('pending')
        return self._parse(data.get(ticket_id) if isinstance(data, dict) else None, receipt=True)
