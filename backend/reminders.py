import os
import datetime
import urllib.request
import urllib.error
import json
from apscheduler.schedulers.background import BackgroundScheduler
from db import get_db

# Load SendGrid configurations from environment variables if present
SENDGRID_API_KEY = os.getenv('SENDGRID_API_KEY')
SENDGRID_FROM_EMAIL = os.getenv('SENDGRID_FROM_EMAIL', 'no-reply@library.com')

def send_email_notification(to_email, student_name, book_title, due_time):
    """
    Dispatches a due date reminder email. Uses SendGrid API if credentials exist,
    otherwise falls back to printing mock email details in the application console logs.
    """
    subject = f"Library Book Due Reminder: {book_title}"
    body_text = (
        f"Hi {student_name},\n\n"
        f"This is an automated reminder that the book '{book_title}' you checked out is due "
        f"on {due_time} (tomorrow).\n\n"
        f"Please return it to the library administration slot to avoid any overdue penalties.\n\n"
        f"Best regards,\n"
        f"Library Kiosk Management System"
    )

    if SENDGRID_API_KEY:
        print(f"[Reminders] Attempting to send SendGrid email to {to_email}...")
        url = "https://api.sendgrid.com/v3/mail/send"
        headers = {
            "Authorization": f"Bearer {SENDGRID_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "personalizations": [
                {
                    "to": [{"email": to_email}],
                    "subject": subject
                }
            ],
            "from": {
                "email": SENDGRID_FROM_EMAIL,
                "name": "Library Kiosk System"
            },
            "content": [
                {
                    "type": "text/plain",
                    "value": body_text
                }
            ]
        }
        try:
            req = urllib.request.Request(
                url, 
                data=json.dumps(payload).encode('utf-8'), 
                headers=headers, 
                method='POST'
            )
            with urllib.request.urlopen(req) as response:
                if response.status == 202:
                    print(f"[Reminders] SendGrid email successfully dispatched to {to_email}.")
                    return True
        except urllib.error.HTTPError as http_err:
            print(f"[Reminders] SendGrid API error ({http_err.code}): {http_err.read().decode('utf-8')}")
        except Exception as e:
            print(f"[Reminders] SendGrid connection failed: {str(e)}")
            
    # Mock fallback
    print("======================================================================")
    print(f"[MOCK EMAIL DISPATCHER] (No SENDGRID_API_KEY configured)")
    print(f"To: {to_email} ({student_name})")
    print(f"Subject: {subject}")
    print(f"Message Body:\n{body_text}")
    print("======================================================================")
    return True

def check_and_send_reminders(app):
    """
    Queries the transactions table for active loans due within the next 24 hours
    and triggers reminder notifications.
    """
    with app.app_context():
        print("[Reminders Job] Running daily due-date check...")
        db_conn = get_db()
        
        now = datetime.datetime.utcnow()
        # Find active checkouts due in 24 hours (between now and 24 hours from now)
        tomorrow = now + datetime.timedelta(days=1)
        
        query = """
            SELECT 
                t.id, 
                u.name AS student_name, 
                u.email AS student_email, 
                b.title AS book_title, 
                t.due_time 
            FROM transactions t
            JOIN users u ON t.user_id = u.id
            JOIN books b ON t.book_id = b.id
            WHERE t.status = 'active' AND t.due_time >= %s AND t.due_time <= %s
        """
        
        reminders_sent = 0
        try:
            with db_conn.cursor() as cursor:
                # SQLite comparison works with datetime strings or datetime objects
                cursor.execute(query, (now, tomorrow))
                due_transactions = cursor.fetchall()
                
                print(f"[Reminders Job] Found {len(due_transactions)} checkouts due within 24h.")
                for tx in due_transactions:
                    due_date_str = tx['due_time']
                    if isinstance(due_date_str, (datetime.date, datetime.datetime)):
                        due_date_str = due_date_str.strftime("%Y-%m-%d %H:%M:%S")
                        
                    send_email_notification(
                        to_email=tx['student_email'],
                        student_name=tx['student_name'],
                        book_title=tx['book_title'],
                        due_time=due_date_str
                    )
                    reminders_sent += 1
                    
        except Exception as error:
            print("[Reminders Job] Database lookup failed:", str(error))
            
        return reminders_sent

def init_scheduler(app):
    """
    Initializes the BackgroundScheduler to run the reminders check daily.
    """
    scheduler = BackgroundScheduler()
    
    # Run the cron job daily at 08:00 AM
    scheduler.add_job(
        func=check_and_send_reminders,
        trigger='cron',
        hour=8,
        minute=0,
        args=[app],
        id='due_reminders_daily_job',
        replace_existing=True
    )
    
    scheduler.start()
    print("[Scheduler] BackgroundScheduler initialized. Daily reminder cron scheduled for 08:00 AM.")
    return scheduler
