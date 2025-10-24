"""
Email Service for HeartLink Dating App
Using Titan Email with SMTP
"""

import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import logging
import ssl

logger = logging.getLogger(__name__)

# SMTP Configuration from environment
SMTP_HOST = os.getenv('SMTP_HOST', 'smtp.titan.email')
SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))
SMTP_USER = os.getenv('SMTP_USER', 'help@heartlink.co.in')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', '')
SMTP_FROM_EMAIL = os.getenv('SMTP_FROM_EMAIL', 'help@heartlink.co.in')
SMTP_FROM_NAME = os.getenv('SMTP_FROM_NAME', 'HeartLink Support')


def send_email(to_email: str, subject: str, html_body: str, text_body: Optional[str] = None) -> dict:
    """
    Send email using Titan SMTP with fallback options
    
    Args:
        to_email: Recipient email address
        subject: Email subject
        html_body: HTML email body
        text_body: Plain text fallback (optional)
    
    Returns:
        dict with success status and message
    """
    # Try multiple SMTP configurations (optimized - try most common first)
    configs = [
        {'port': 587, 'use_tls': True, 'use_ssl': False},  # STARTTLS (most common)
    ]
    
    last_error = None
    
    for config in configs:
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['From'] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
            msg['To'] = to_email
            msg['Subject'] = subject
            
            # Add plain text version if provided
            if text_body:
                part1 = MIMEText(text_body, 'plain')
                msg.attach(part1)
            
            # Add HTML version
            part2 = MIMEText(html_body, 'html')
            msg.attach(part2)
            
            # Try connection based on config
            if config['use_ssl']:
                # SSL connection (port 465)
                context = ssl.create_default_context()
                context.check_hostname = False
                context.verify_mode = ssl.CERT_NONE
                with smtplib.SMTP_SSL(SMTP_HOST, config['port'], context=context, timeout=3) as server:
                    server.login(SMTP_USER, SMTP_PASSWORD)
                    server.send_message(msg)
                    
            else:
                # TLS connection (port 587 or 25)
                with smtplib.SMTP(SMTP_HOST, config['port'], timeout=3) as server:
                    server.set_debuglevel(0)
                    if config['use_tls']:
                        server.starttls()
                    server.login(SMTP_USER, SMTP_PASSWORD)
                    server.send_message(msg)
            
            logger.info(f"✅ Email sent successfully to {to_email} using port {config['port']}")
            return {"success": True, "message": "Email sent successfully", "port_used": config['port']}
            
        except smtplib.SMTPAuthenticationError as e:
            last_error = f"Authentication failed on port {config['port']}: {str(e)}"
            logger.warning(last_error)
            continue
            
        except Exception as e:
            last_error = f"Error on port {config['port']}: {str(e)}"
            logger.warning(last_error)
            continue
    
    # All configs failed
    logger.error(f"❌ All SMTP configurations failed. Last error: {last_error}")
    return {"success": False, "error": last_error}


def send_otp_email(to_email: str, otp_code: str, user_name: str = "User") -> dict:
    """Send OTP email for password reset"""
    
    subject = "🔐 Your HeartLink Password Reset Code"
    
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f9fafb;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 20px;">
            <tr>
                <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                        
                        <!-- Header with Gradient -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #ec4899 0%, #f97316 100%); padding: 40px 20px; text-align: center;">
                                <h1 style="color: #ffffff; margin: 0; font-size: 32px;">💕 HeartLink</h1>
                                <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px;">Password Reset Request</p>
                            </td>
                        </tr>
                        
                        <!-- Content -->
                        <tr>
                            <td style="padding: 40px 30px;">
                                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                    Hi <strong>{user_name}</strong>,
                                </p>
                                
                                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                                    We received a request to reset your HeartLink password. Use the code below to reset your password:
                                </p>
                                
                                <!-- OTP Box -->
                                <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 30px 0;">
                                    <tr>
                                        <td align="center" style="background: linear-gradient(135deg, #fce7f3 0%, #fed7aa 100%); border: 3px dashed #ec4899; border-radius: 12px; padding: 30px;">
                                            <p style="color: #9ca3af; font-size: 14px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Your OTP Code</p>
                                            <p style="color: #ec4899; font-size: 48px; font-weight: bold; margin: 0; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                                                {otp_code}
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                                
                                <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                                    ⏱️ This code will expire in <strong>15 minutes</strong>.
                                </p>
                                
                                <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
                                    If you didn't request this password reset, please ignore this email or contact our support team.
                                </p>
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                                <p style="color: #9ca3af; font-size: 12px; margin: 0 0 10px 0;">
                                    Need help? Contact us at <a href="mailto:help@heartlink.co.in" style="color: #ec4899; text-decoration: none;">help@heartlink.co.in</a>
                                </p>
                                <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                    © 2025 HeartLink. All rights reserved.
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
    
    text_body = f"""
    Hi {user_name},
    
    We received a request to reset your HeartLink password.
    
    Your OTP Code: {otp_code}
    
    This code will expire in 15 minutes.
    
    If you didn't request this password reset, please ignore this email.
    
    Need help? Contact us at help@heartlink.co.in
    
    © 2025 HeartLink. All rights reserved.
    """
    
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
