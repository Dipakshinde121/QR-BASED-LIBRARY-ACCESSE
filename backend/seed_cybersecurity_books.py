import os
import pymysql
from dotenv import load_dotenv

# Ensure env variables are loaded from the local .env
load_dotenv()

BOOKS_DATA = [
    ('BK-CYB-601', 'The Web Application Hacker\'s Handbook', 'Dafydd Stuttard', 'Row 4, Shelf A', 'available'),
    ('BK-CYB-602', 'Hacking: The Art of Exploitation', 'Jon Erickson', 'Row 4, Shelf B', 'available'),
    ('BK-CYB-603', 'Practical Malware Analysis', 'Michael Sikorski', 'Row 4, Shelf C', 'available'),
    ('BK-CYB-604', 'The Art of Invisibility', 'Kevin Mitnick', 'Row 5, Shelf A', 'available'),
    ('BK-CYB-605', 'Social Engineering: The Science of Human Hacking', 'Christopher Hadnagy', 'Row 5, Shelf B', 'available'),
    ('BK-CYB-606', 'Applied Cryptography', 'Bruce Schneier', 'Row 5, Shelf C', 'available'),
    ('BK-CYB-607', 'Blue Team Handbook: Incident Response Edition', 'Don Murdoch', 'Row 6, Shelf A', 'available'),
    ('BK-CYB-608', 'Threat Modeling: Designing for Security', 'Adam Shostack', 'Row 6, Shelf B', 'available'),
    ('BK-CYB-609', 'Black Hat Python', 'Justin Seitz', 'Row 6, Shelf C', 'available'),
    ('BK-CYB-610', 'Violent Python', 'TJ O\'Connor', 'Row 7, Shelf A', 'available'),
    ('BK-CYB-611', 'RTFM: Red Team Field Manual', 'Ben Clark', 'Row 7, Shelf B', 'available'),
    ('BK-CYB-612', 'BTFM: Blue Team Field Manual', 'Alan White', 'Row 7, Shelf C', 'available'),
    ('BK-CYB-613', 'The Hacker Playbook 3', 'Peter Kim', 'Row 8, Shelf A', 'available'),
    ('BK-CYB-614', 'Metasploit: The Penetration Tester\'s Guide', 'David Kennedy', 'Row 8, Shelf B', 'available'),
    ('BK-CYB-615', 'Ghost in the Wires', 'Kevin Mitnick', 'Row 8, Shelf C', 'available'),
    ('BK-CYB-616', 'Network Security Bible', 'Gary Cole', 'Row 9, Shelf A', 'available'),
    ('BK-CYB-617', 'The Tangled Web', 'Michal Zalewski', 'Row 9, Shelf B', 'available'),
    ('BK-CYB-618', 'Penetration Testing: A Hands-On Introduction', 'Georgia Weidman', 'Row 9, Shelf C', 'available'),
    ('BK-CYB-619', 'Computer Hacking Forensic Investigator', 'EC-Council', 'Row 10, Shelf A', 'available'),
    ('BK-CYB-620', 'Rootkits: Subverting the Windows Kernel', 'Greg Hoglund', 'Row 10, Shelf B', 'available'),
    ('BK-CYB-621', 'Malware Analyst\'s Cookbook', 'Michael Ligh', 'Row 10, Shelf C', 'available'),
    ('BK-CYB-622', 'The Art of Memory Forensics', 'Michael Hale Ligh', 'Row 11, Shelf A', 'available'),
    ('BK-CYB-623', 'Practical Reverse Engineering', 'Bruce Dang', 'Row 11, Shelf B', 'available'),
    ('BK-CYB-624', 'Windows Internals', 'Pavel Yosifovich', 'Row 11, Shelf C', 'available'),
    ('BK-CYB-625', 'Wireshark Network Analysis', 'Laura Chappell', 'Row 12, Shelf A', 'available'),
    ('BK-CYB-626', 'Network Forensics: Tracking Hackers', 'Sherri Davidoff', 'Row 12, Shelf B', 'available'),
    ('BK-CYB-627', 'Cuckoo Malware Analysis', 'Digit Voly', 'Row 12, Shelf C', 'available'),
    ('BK-CYB-628', 'Alice and Bob Learn Application Security', 'Tanya Janca', 'Row 13, Shelf A', 'available'),
    ('BK-CYB-629', 'Foundations of Information Security', 'Jason Andress', 'Row 13, Shelf B', 'available'),
    ('BK-CYB-630', 'Cybersecurity for Beginners', 'Raef Meeuwisse', 'Row 13, Shelf C', 'available'),
    ('BK-CYB-631', 'CompTIA Security+ Study Guide', 'Mike Chapple', 'Row 14, Shelf A', 'available'),
    ('BK-CYB-632', 'CISSP All-in-One Exam Guide', 'Shon Harris', 'Row 14, Shelf B', 'available'),
    ('BK-CYB-633', 'Nmap Network Scanning', 'Gordon Fyodor Lyon', 'Row 14, Shelf C', 'available'),
    ('BK-CYB-634', 'Hacking Exposed 7', 'Stuart McClure', 'Row 15, Shelf A', 'available'),
    ('BK-CYB-635', 'The Basics of Hacking and Penetration Testing', 'Patrick Engebretson', 'Row 15, Shelf B', 'available'),
    ('BK-CYB-636', 'Bug Bounty Bootcamp', 'Vickie Li', 'Row 15, Shelf C', 'available'),
    ('BK-CYB-637', 'Real-World Bug Hunting', 'Peter Yaworski', 'Row 16, Shelf A', 'available'),
    ('BK-CYB-638', 'Web Security for Developers', 'Malcolm McDonald', 'Row 16, Shelf B', 'available'),
    ('BK-CYB-639', 'Secure Coding in C and C++', 'Robert C. Seacord', 'Row 16, Shelf C', 'available'),
    ('BK-CYB-640', 'Defeating Document Encryption', 'Vladislav P.', 'Row 17, Shelf A', 'available'),
    ('BK-CYB-641', 'Practical Social Engineering', 'Joe Gray', 'Row 17, Shelf B', 'available'),
    ('BK-CYB-642', 'Tribe of Hackers: Cybersecurity Advice', 'Marcus J. Carey', 'Row 17, Shelf C', 'available'),
    ('BK-CYB-643', 'Sandworm: A New Era of Cyberwar', 'Andy Greenberg', 'Row 18, Shelf A', 'available'),
    ('BK-CYB-644', 'Countdown to Zero Day', 'Kim Zetter', 'Row 18, Shelf B', 'available'),
    ('BK-CYB-645', 'The Cuckoo\'s Egg', 'Clifford Stoll', 'Row 18, Shelf C', 'available'),
    ('BK-CYB-646', 'Dark Territory: The Secret History of Cyber War', 'Fred Kaplan', 'Row 19, Shelf A', 'available'),
    ('BK-CYB-647', 'Spam Nation', 'Brian Krebs', 'Row 19, Shelf B', 'available'),
    ('BK-CYB-648', 'We Are Anonymous', 'Parmy Olson', 'Row 19, Shelf C', 'available'),
    ('BK-CYB-649', 'Cult of the Dead Cow', 'Joseph Menn', 'Row 20, Shelf A', 'available'),
    ('BK-CYB-650', 'The Code Book: The Science of Secrecy', 'Simon Singh', 'Row 20, Shelf B', 'available')
]

def seed_books():
    host = os.getenv('DB_HOST', 'localhost')
    user = os.getenv('DB_USER', 'root')
    password = os.getenv('DB_PASSWORD', '')
    database = os.getenv('DB_NAME', 'library_access_db')

    print(f"Connecting to database '{database}' on '{host}' as '{user}'...")
    try:
        connection = pymysql.connect(
            host=host,
            user=user,
            password=password,
            database=database,
            cursorclass=pymysql.cursors.DictCursor
        )
    except Exception as e:
        print("\n[Connection failed!]")
        print(f"Error: {e}")
        print("Please ensure your MySQL database server is running (e.g. XAMPP).")
        return

    try:
        with connection.cursor() as cursor:
            # Check existing book uids to avoid duplicates
            cursor.execute("SELECT book_uid FROM books")
            existing_uids = {row['book_uid'] for row in cursor.fetchall()}

            inserted_count = 0
            skipped_count = 0

            insert_query = """
                INSERT INTO books (book_uid, title, author, slot_location, status)
                VALUES (%s, %s, %s, %s, %s)
            """

            for book_uid, title, author, slot, status in BOOKS_DATA:
                if book_uid not in existing_uids:
                    cursor.execute(insert_query, (book_uid, title, author, slot, status))
                    inserted_count += 1
                else:
                    skipped_count += 1

            connection.commit()
            print("\nDatabase seeding completed successfully!")
            print(f"-> Inserted: {inserted_count} new books.")
            print(f"-> Skipped: {skipped_count} books (already in database).")

    except Exception as e:
        connection.rollback()
        print(f"\nAn error occurred while seeding: {e}")
    finally:
        connection.close()

if __name__ == '__main__':
    seed_books()
