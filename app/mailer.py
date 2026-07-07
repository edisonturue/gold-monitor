from __future__ import annotations

import smtplib
from email.message import EmailMessage

from app.config import Settings


class SmtpMailer:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def configured(self) -> bool:
        return bool(
            str(self.settings.smtp_host or "").strip()
            and int(self.settings.smtp_port or 0) > 0
            and str(self.settings.smtp_user or "").strip()
            and str(self.settings.smtp_pass or "").strip()
            and str(self.settings.smtp_from or "").strip()
        )

    def send_bootstrap_verification(self, email: str, code: str, ttl_sec: int) -> None:
        if not self.configured():
            raise RuntimeError("smtp not configured")

        subject = "金价监控台 - 管理员初始化验证码"
        body = (
            "你正在初始化金价监控台管理员账号。\n\n"
            f"验证码：{code}\n"
            f"有效期：{ttl_sec} 秒\n\n"
            "如果这不是你的操作，请忽略本邮件。"
        )

        self._send_mail(email=email, subject=subject, body=body)

    def send_registration_verification(self, email: str, code: str, ttl_sec: int) -> None:
        if not self.configured():
            raise RuntimeError("smtp not configured")

        subject = "金价监控台 - 用户注册验证码"
        body = (
            "你正在注册金价监控台账号。\n\n"
            f"验证码：{code}\n"
            f"有效期：{ttl_sec} 秒\n\n"
            "如果这不是你的操作，请忽略本邮件。"
        )
        self._send_mail(email=email, subject=subject, body=body)

    def send_password_reset_verification(self, email: str, code: str, ttl_sec: int) -> None:
        if not self.configured():
            raise RuntimeError("smtp not configured")

        subject = "金价监控台 - 找回密码验证码"
        body = (
            "你正在重置金价监控台登录密码。\n\n"
            f"验证码：{code}\n"
            f"有效期：{ttl_sec} 秒\n\n"
            "如果这不是你的操作，请忽略本邮件。"
        )
        self._send_mail(email=email, subject=subject, body=body)

    def _send_mail(self, *, email: str, subject: str, body: str) -> None:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = self.settings.smtp_from
        msg["To"] = email
        msg.set_content(body)

        host = str(self.settings.smtp_host).strip()
        port = int(self.settings.smtp_port)
        username = str(self.settings.smtp_user).strip()
        password = str(self.settings.smtp_pass)
        use_ssl = bool(self.settings.smtp_use_ssl)
        use_tls = bool(self.settings.smtp_use_tls)

        if use_ssl:
            with smtplib.SMTP_SSL(host, port, timeout=15) as smtp:
                smtp.login(username, password)
                smtp.send_message(msg)
            return

        with smtplib.SMTP(host, port, timeout=15) as smtp:
            smtp.ehlo()
            if use_tls:
                smtp.starttls()
                smtp.ehlo()
            smtp.login(username, password)
            smtp.send_message(msg)
