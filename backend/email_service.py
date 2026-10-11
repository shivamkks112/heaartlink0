"""
Email Service for HeartLink Dating App
Primary: Resend API (fast, reliable)
Fallback: Microsoft 365 SMTP
"""

import smtplib
import os
import resend
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import logging
import ssl

logger = logging.getLogger(__name__)

# Resend Configuration
RESEND_API_KEY = os.getenv('RESEND_API_KEY', '')
RESEND_FROM_EMAIL = os.getenv('RESEND_FROM_EMAIL', 'HeartLink Support <help@heartlink.co.in>')

# SMTP Configuration (fallback)
SMTP_HOST = os.getenv('SMTP_HOST', 'smtp.office365.com')
SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))
SMTP_USER = os.getenv('SMTP_USER', 'help@heartlink.co.in')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', '')
SMTP_FROM_EMAIL = os.getenv('SMTP_FROM_EMAIL', 'help@heartlink.co.in')
SMTP_FROM_NAME = os.getenv('SMTP_FROM_NAME', 'HeartLink Support')

# Fallback: read password directly from .env if env var has issues with special chars
if not SMTP_PASSWORD or len(SMTP_PASSWORD) < 5:
    try:
        from pathlib import Path
        env_path = Path(__file__).parent / '.env'
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if line.startswith('SMTP_PASSWORD='):
                    SMTP_PASSWORD = line.split('=', 1)[1].strip().strip('"').strip("'")
                    break
    except Exception:
        pass

# Initialize Resend
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


def send_email_resend(to_email: str, subject: str, html_body: str) -> dict:
    """Send email via Resend API (primary)"""
    try:
        params = {
            "from": RESEND_FROM_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html_body,
        }
        result = resend.Emails.send(params)
        logger.info(f"✅ Resend email sent to {to_email} (ID: {result.get('id', 'unknown')})")
        return {"success": True, "message": "Email sent via Resend", "provider": "resend"}
    except Exception as e:
        logger.error(f"❌ Resend failed: {e}")
        return {"success": False, "error": str(e), "provider": "resend"}


def send_email_smtp(to_email: str, subject: str, html_body: str, text_body: Optional[str] = None) -> dict:
    """Send email via SMTP (fallback)"""
    try:
        msg = MIMEMultipart('alternative')
        msg['From'] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
        msg['To'] = to_email
        msg['Subject'] = subject
        
        if text_body:
            msg.attach(MIMEText(text_body, 'plain'))
        msg.attach(MIMEText(html_body, 'html'))
        
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        
        logger.info(f"✅ SMTP email sent to {to_email}")
        return {"success": True, "message": "Email sent via SMTP", "provider": "smtp"}
    except Exception as e:
        logger.error(f"❌ SMTP failed: {e}")
        return {"success": False, "error": str(e), "provider": "smtp"}


def send_email(to_email: str, subject: str, html_body: str, text_body: Optional[str] = None) -> dict:
    """
    Send email - tries Resend first, falls back to SMTP
    """
    # Try Resend first (faster, more reliable)
    if RESEND_API_KEY:
        result = send_email_resend(to_email, subject, html_body)
        if result["success"]:
            return result
        logger.warning(f"Resend failed, falling back to SMTP for {to_email}")
    
    # Fallback to SMTP
    return send_email_smtp(to_email, subject, html_body, text_body)


def send_otp_email(to_email: str, otp_code: str, user_name: str = "User") -> dict:
    """Send OTP email for PASSWORD RESET only"""
    
    subject = "Reset Your HeartLink Password"
    
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f9fafb;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:20px;">
            <tr><td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                    <tr><td style="background:linear-gradient(135deg,#ec4899 0%,#f97316 100%);padding:40px 20px;text-align:center;">
                        <h1 style="color:#fff;margin:0;font-size:32px;">HeartLink</h1>
                        <p style="color:#fff;margin:10px 0 0;font-size:16px;">Password Reset</p>
                    </td></tr>
                    <tr><td style="padding:40px 30px;">
                        <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Hi <strong>{user_name}</strong>,</p>
                        <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 30px;">We received a request to reset your HeartLink password. Use the code below to reset your password:</p>
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 30px;">
                            <tr><td align="center" style="background:linear-gradient(135deg,#fce7f3 0%,#fed7aa 100%);border:3px dashed #ec4899;border-radius:12px;padding:30px;">
                                <p style="color:#9ca3af;font-size:14px;margin:0 0 10px;text-transform:uppercase;letter-spacing:1px;">Password Reset Code</p>
                                <p style="color:#ec4899;font-size:48px;font-weight:bold;margin:0;letter-spacing:8px;font-family:'Courier New',monospace;">{otp_code}</p>
                            </td></tr>
                        </table>
                        <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 20px;">This code will expire in <strong>15 minutes</strong>.</p>
                        <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0;">If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
                    </td></tr>
                    <tr><td style="background:#f9fafb;padding:30px;text-align:center;border-top:1px solid #e5e7eb;">
                        <p style="color:#9ca3af;font-size:12px;margin:0 0 10px;">Need help? <a href="mailto:help@heartlink.co.in" style="color:#ec4899;text-decoration:none;">help@heartlink.co.in</a></p>
                        <p style="color:#9ca3af;font-size:12px;margin:0;">HeartLink. All rights reserved.</p>
                    </td></tr>
                </table>
            </td></tr>
        </table>
    </body>
    </html>
    """
    
    text_body = f"Hi {user_name},\n\nYour HeartLink password reset code is: {otp_code}\n\nThis code expires in 15 minutes.\n\nIf you didn't request this, ignore this email.\n\nHeartLink Support"
    
    return send_email(to_email, subject, html_body, text_body)


def send_signup_otp_email(to_email: str, otp_code: str, user_name: str = "User") -> dict:
    """Send OTP email for SIGNUP VERIFICATION only"""
    
    subject = "Verify Your Email \u2013 HeartLink"
    
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f9fafb;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:20px;">
            <tr><td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                    <tr><td style="background:linear-gradient(135deg,#ec4899 0%,#f97316 100%);padding:40px 20px;text-align:center;">
                        <h1 style="color:#fff;margin:0;font-size:32px;">HeartLink</h1>
                        <p style="color:#fff;margin:10px 0 0;font-size:16px;">Email Verification</p>
                    </td></tr>
                    <tr><td style="padding:40px 30px;">
                        <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Hi <strong>{user_name}</strong>,</p>
                        <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 30px;">Welcome to HeartLink! To create your account, please verify your email address using the code below:</p>
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 30px;">
                            <tr><td align="center" style="background:linear-gradient(135deg,#fce7f3 0%,#fed7aa 100%);border:3px dashed #ec4899;border-radius:12px;padding:30px;">
                                <p style="color:#9ca3af;font-size:14px;margin:0 0 10px;text-transform:uppercase;letter-spacing:1px;">Verification Code</p>
                                <p style="color:#ec4899;font-size:48px;font-weight:bold;margin:0;letter-spacing:8px;font-family:'Courier New',monospace;">{otp_code}</p>
                            </td></tr>
                        </table>
                        <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 20px;">This code will expire in <strong>10 minutes</strong>.</p>
                        <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0;">If you didn't sign up for HeartLink, please ignore this email.</p>
                    </td></tr>
                    <tr><td style="background:#f9fafb;padding:30px;text-align:center;border-top:1px solid #e5e7eb;">
                        <p style="color:#9ca3af;font-size:12px;margin:0 0 10px;">Need help? <a href="mailto:help@heartlink.co.in" style="color:#ec4899;text-decoration:none;">help@heartlink.co.in</a></p>
                        <p style="color:#9ca3af;font-size:12px;margin:0;">HeartLink. All rights reserved.</p>
                    </td></tr>
                </table>
            </td></tr>
        </table>
    </body>
    </html>
    """
    
    text_body = f"Hi {user_name},\n\nWelcome to HeartLink! Your email verification code is: {otp_code}\n\nThis code expires in 10 minutes.\n\nIf you didn't sign up, ignore this email.\n\nHeartLink Support"
    
    return send_email(to_email, subject, html_body, text_body)


def send_welcome_email(to_email: str, user_name: str) -> dict:
    """Send welcome email to new users"""
    
    subject = "💕 Welcome to HeartLink - Let's Find Your Match!"
    
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f9fafb;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 20px;">
            <tr>
                <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden;">
                        <tr>
                            <td style="background: linear-gradient(135deg, #ec4899 0%, #f97316 100%); padding: 50px 20px; text-align: center;">
                                <h1 style="color: #ffffff; margin: 0; font-size: 36px;">💕 Welcome to HeartLink!</h1>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 40px 30px;">
                                <p style="color: #374151; font-size: 18px; margin: 0 0 20px 0;">
                                    Hi <strong>{user_name}</strong>! 👋
                                </p>
                                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                    Welcome to India's most trusted dating platform! We're excited to help you find meaningful connections.
                                </p>
                                <h3 style="color: #ec4899; margin: 30px 0 15px 0;">✨ Get Started:</h3>
                                <ul style="color: #374151; font-size: 15px; line-height: 1.8;">
                                    <li>Complete your profile with photos and bio</li>
                                    <li>Get verified to build trust</li>
                                    <li>Start swiping and find your match!</li>
                                </ul>
                                <p style="color: #6b7280; font-size: 14px; margin: 30px 0 0 0;">
                                    Need help? We're here for you at <a href="mailto:help@heartlink.co.in" style="color: #ec4899;">help@heartlink.co.in</a>
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    return send_email(to_email, subject, html_body)


def send_verification_email(to_email: str, user_name: str, status: str) -> dict:
    """Send verification status email"""
    
    if status == "approved":
        subject = "✅ Your HeartLink Profile is Verified!"
        emoji = "🎉"
        message = "Congratulations! Your profile has been verified by our team. You now have a verified badge on your profile."
    else:
        subject = "⚠️ HeartLink Profile Verification Update"
        emoji = "💭"
        message = "Your profile verification needs some updates. Please ensure your profile meets our community guidelines."
    
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f9fafb;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 20px;">
            <tr>
                <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px;">
                        <tr>
                            <td style="padding: 40px 30px; text-align: center;">
                                <p style="font-size: 64px; margin: 0 0 20px 0;">{emoji}</p>
                                <h2 style="color: #374151; margin: 0 0 20px 0;">{subject}</h2>
                                <p style="color: #6b7280; font-size: 16px; line-height: 1.6;">
                                    Hi <strong>{user_name}</strong>,<br><br>
                                    {message}
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    return send_email(to_email, subject, html_body)
