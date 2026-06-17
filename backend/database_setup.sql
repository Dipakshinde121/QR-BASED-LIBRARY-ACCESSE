-- ====================================================================
-- Database Setup Script: library_access_db
-- Target Engine: MySQL / MariaDB (Compatible with XAMPP/phpMyAdmin)
-- Description: Creates tables for users, books, and transactions,
--              and populates them with initial mock data.
-- ====================================================================

-- 1. Database Initialization
CREATE DATABASE IF NOT EXISTS `library_access_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `library_access_db`;

-- Remove tables in reverse dependency order if they exist
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `transactions`;
DROP TABLE IF EXISTS `books`;
DROP TABLE IF EXISTS `users`;
SET FOREIGN_KEY_CHECKS = 1;

-- ====================================================================
-- 2. Table Creation
-- ====================================================================

-- Table: users (Stores credentials for both admins and students)
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `roll_number` VARCHAR(50) UNIQUE DEFAULT NULL COMMENT 'Roll number (required for students, null for admins)',
  `name` VARCHAR(100) NOT NULL COMMENT 'Full name of the user',
  `email` VARCHAR(100) UNIQUE NOT NULL COMMENT 'Institutional email address',
  `password_hash` VARCHAR(255) NOT NULL COMMENT 'Securely hashed password',
  `role` ENUM('student', 'admin') NOT NULL DEFAULT 'student' COMMENT 'User access role',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: books (Tracks physical inventory in the lab)
CREATE TABLE `books` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `book_uid` VARCHAR(50) UNIQUE NOT NULL COMMENT 'Custom readable barcode/QR ID (e.g. BK-ALG-101)',
  `title` VARCHAR(255) NOT NULL COMMENT 'Title of the book',
  `author` VARCHAR(100) NOT NULL COMMENT 'Author of the book',
  `slot_location` VARCHAR(50) NOT NULL COMMENT 'Physical location in the lab (e.g. Row 1, Shelf A)',
  `status` ENUM('available', 'checked_out', 'maintenance') NOT NULL DEFAULT 'available' COMMENT 'Inventory status',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: transactions (Logs all book checkouts and returns via QR scans)
CREATE TABLE `transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL COMMENT 'Foreign key to users table',
  `book_id` INT NOT NULL COMMENT 'Foreign key to books table',
  `checkout_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Time when the book was scanned out',
  `due_time` TIMESTAMP NOT NULL COMMENT 'Calculated return deadline',
  `return_time` TIMESTAMP NULL DEFAULT NULL COMMENT 'Time when the book was returned (null if active)',
  `status` ENUM('active', 'returned', 'overdue') NOT NULL DEFAULT 'active' COMMENT 'Current transaction status',
  CONSTRAINT `fk_transactions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_transactions_book` FOREIGN KEY (`book_id`) REFERENCES `books` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ====================================================================
-- 3. Mock Data Insertion
-- ====================================================================

-- Insert Users (Admins and Students)
-- Note: passwords are pre-seeded hashes (e.g., using typical bcrypt/argon2 format placeholder)
INSERT INTO `users` (`id`, `roll_number`, `name`, `email`, `password_hash`, `role`) VALUES
(1, NULL, 'Library Admin', 'admin@library.com', '$2b$12$R9hKbEv18zTf.eBPQfJyV.2qHh/fD59yNshU3m401aY2vIq2k0P1K', 'admin'),
(2, 'ST-2026-01', 'Satyam Kumar', 'satyam@library.com', '$2b$12$K8yX.a9P2Q.dJ4w2rFv1Ze2mHh/fD59yNshU3m401aY2vIq2k0P2L', 'student'),
(3, 'ST-2026-02', 'Dipak Shinde', 'dipak@library.com', '$2b$12$W9zV.b8O1P.eI3v1qEu0Yd1lGg/eC48xMrgT2l390zX1uHp1j9O3M', 'student'),
(4, 'ST-2026-03', 'Rohan Sharma', 'rohan@library.com', '$2b$12$M7xU.c7N0O.dH2u0pDt9Xc0kFf/dB37wLqfS1k280yW0tGo0i8N2K', 'student');

-- Insert Books (Physical Inventory)
INSERT INTO `books` (`id`, `book_uid`, `title`, `author`, `slot_location`, `status`) VALUES
(1, 'BK-ALG-101', 'Introduction to Algorithms', 'Thomas H. Cormen', 'Row 1, Shelf A', 'available'),
(2, 'BK-CCN-202', 'Clean Code', 'Robert C. Martin', 'Row 2, Shelf B', 'checked_out'),
(3, 'BK-DP-303', 'Design Patterns', 'Erich Gamma', 'Row 2, Shelf C', 'available'),
(4, 'BK-PP-404', 'The Pragmatic Programmer', 'Andrew Hunt', 'Row 3, Shelf A', 'available'),
(5, 'BK-JSGP-505', 'JavaScript: The Good Parts', 'Douglas Crockford', 'Row 3, Shelf B', 'maintenance'),
(6, 'BK-CYB-601', 'The Web Application Hacker\'s Handbook', 'Dafydd Stuttard', 'Row 4, Shelf A', 'available'),
(7, 'BK-CYB-602', 'Hacking: The Art of Exploitation', 'Jon Erickson', 'Row 4, Shelf B', 'available'),
(8, 'BK-CYB-603', 'Practical Malware Analysis', 'Michael Sikorski', 'Row 4, Shelf C', 'available'),
(9, 'BK-CYB-604', 'The Art of Invisibility', 'Kevin Mitnick', 'Row 5, Shelf A', 'available'),
(10, 'BK-CYB-605', 'Social Engineering: The Science of Human Hacking', 'Christopher Hadnagy', 'Row 5, Shelf B', 'available'),
(11, 'BK-CYB-606', 'Applied Cryptography', 'Bruce Schneier', 'Row 5, Shelf C', 'available'),
(12, 'BK-CYB-607', 'Blue Team Handbook: Incident Response Edition', 'Don Murdoch', 'Row 6, Shelf A', 'available'),
(13, 'BK-CYB-608', 'Threat Modeling: Designing for Security', 'Adam Shostack', 'Row 6, Shelf B', 'available'),
(14, 'BK-CYB-609', 'Black Hat Python', 'Justin Seitz', 'Row 6, Shelf C', 'available'),
(15, 'BK-CYB-610', 'Violent Python', 'TJ O\'Connor', 'Row 7, Shelf A', 'available'),
(16, 'BK-CYB-611', 'RTFM: Red Team Field Manual', 'Ben Clark', 'Row 7, Shelf B', 'available'),
(17, 'BK-CYB-612', 'BTFM: Blue Team Field Manual', 'Alan White', 'Row 7, Shelf C', 'available'),
(18, 'BK-CYB-613', 'The Hacker Playbook 3', 'Peter Kim', 'Row 8, Shelf A', 'available'),
(19, 'BK-CYB-614', 'Metasploit: The Penetration Tester\'s Guide', 'David Kennedy', 'Row 8, Shelf B', 'available'),
(20, 'BK-CYB-615', 'Ghost in the Wires', 'Kevin Mitnick', 'Row 8, Shelf C', 'available'),
(21, 'BK-CYB-616', 'Network Security Bible', 'Gary Cole', 'Row 9, Shelf A', 'available'),
(22, 'BK-CYB-617', 'The Tangled Web', 'Michal Zalewski', 'Row 9, Shelf B', 'available'),
(23, 'BK-CYB-618', 'Penetration Testing: A Hands-On Introduction', 'Georgia Weidman', 'Row 9, Shelf C', 'available'),
(24, 'BK-CYB-619', 'Computer Hacking Forensic Investigator', 'EC-Council', 'Row 10, Shelf A', 'available'),
(25, 'BK-CYB-620', 'Rootkits: Subverting the Windows Kernel', 'Greg Hoglund', 'Row 10, Shelf B', 'available'),
(26, 'BK-CYB-621', 'Malware Analyst\'s Cookbook', 'Michael Ligh', 'Row 10, Shelf C', 'available'),
(27, 'BK-CYB-622', 'The Art of Memory Forensics', 'Michael Hale Ligh', 'Row 11, Shelf A', 'available'),
(28, 'BK-CYB-623', 'Practical Reverse Engineering', 'Bruce Dang', 'Row 11, Shelf B', 'available'),
(29, 'BK-CYB-624', 'Windows Internals', 'Pavel Yosifovich', 'Row 11, Shelf C', 'available'),
(30, 'BK-CYB-625', 'Wireshark Network Analysis', 'Laura Chappell', 'Row 12, Shelf A', 'available'),
(31, 'BK-CYB-626', 'Network Forensics: Tracking Hackers', 'Sherri Davidoff', 'Row 12, Shelf B', 'available'),
(32, 'BK-CYB-627', 'Cuckoo Malware Analysis', 'Digit Voly', 'Row 12, Shelf C', 'available'),
(33, 'BK-CYB-628', 'Alice and Bob Learn Application Security', 'Tanya Janca', 'Row 13, Shelf A', 'available'),
(34, 'BK-CYB-629', 'Foundations of Information Security', 'Jason Andress', 'Row 13, Shelf B', 'available'),
(35, 'BK-CYB-630', 'Cybersecurity for Beginners', 'Raef Meeuwisse', 'Row 13, Shelf C', 'available'),
(36, 'BK-CYB-631', 'CompTIA Security+ Study Guide', 'Mike Chapple', 'Row 14, Shelf A', 'available'),
(37, 'BK-CYB-632', 'CISSP All-in-One Exam Guide', 'Shon Harris', 'Row 14, Shelf B', 'available'),
(38, 'BK-CYB-633', 'Nmap Network Scanning', 'Gordon Fyodor Lyon', 'Row 14, Shelf C', 'available'),
(39, 'BK-CYB-634', 'Hacking Exposed 7', 'Stuart McClure', 'Row 15, Shelf A', 'available'),
(40, 'BK-CYB-635', 'The Basics of Hacking and Penetration Testing', 'Patrick Engebretson', 'Row 15, Shelf B', 'available'),
(41, 'BK-CYB-636', 'Bug Bounty Bootcamp', 'Vickie Li', 'Row 15, Shelf C', 'available'),
(42, 'BK-CYB-637', 'Real-World Bug Hunting', 'Peter Yaworski', 'Row 16, Shelf A', 'available'),
(43, 'BK-CYB-638', 'Web Security for Developers', 'Malcolm McDonald', 'Row 16, Shelf B', 'available'),
(44, 'BK-CYB-639', 'Secure Coding in C and C++', 'Robert C. Seacord', 'Row 16, Shelf C', 'available'),
(45, 'BK-CYB-640', 'Defeating Document Encryption', 'Vladislav P.', 'Row 17, Shelf A', 'available'),
(46, 'BK-CYB-641', 'Practical Social Engineering', 'Joe Gray', 'Row 17, Shelf B', 'available'),
(47, 'BK-CYB-642', 'Tribe of Hackers: Cybersecurity Advice', 'Marcus J. Carey', 'Row 17, Shelf C', 'available'),
(48, 'BK-CYB-643', 'Sandworm: A New Era of Cyberwar', 'Andy Greenberg', 'Row 18, Shelf A', 'available'),
(49, 'BK-CYB-644', 'Countdown to Zero Day', 'Kim Zetter', 'Row 18, Shelf B', 'available'),
(50, 'BK-CYB-645', 'The Cuckoo\'s Egg', 'Clifford Stoll', 'Row 18, Shelf C', 'available'),
(51, 'BK-CYB-646', 'Dark Territory: The Secret History of Cyber War', 'Fred Kaplan', 'Row 19, Shelf A', 'available'),
(52, 'BK-CYB-647', 'Spam Nation', 'Brian Krebs', 'Row 19, Shelf B', 'available'),
(53, 'BK-CYB-648', 'We Are Anonymous', 'Parmy Olson', 'Row 19, Shelf C', 'available'),
(54, 'BK-CYB-649', 'Cult of the Dead Cow', 'Joseph Menn', 'Row 20, Shelf A', 'available'),
(55, 'BK-CYB-650', 'The Code Book: The Science of Secrecy', 'Simon Singh', 'Row 20, Shelf B', 'available');


-- Insert Transactions (Mock checkout log records)
-- Transaction 1: Active checkout for Dipak Shinde (user_id=3) checking out Clean Code (book_id=2)
-- Checked out 2 days ago, due in 12 days.
INSERT INTO `transactions` (`id`, `user_id`, `book_id`, `checkout_time`, `due_time`, `return_time`, `status`) VALUES
(1, 3, 2, 
 DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 2 DAY), 
 DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 12 DAY), 
 NULL, 
 'active');

-- Transaction 2: Completed checkout for Satyam Kumar (user_id=2) checking out Design Patterns (book_id=3)
-- Checked out 10 days ago, due 4 days later, returned 8 days ago.
INSERT INTO `transactions` (`id`, `user_id`, `book_id`, `checkout_time`, `due_time`, `return_time`, `status`) VALUES
(2, 2, 3, 
 DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 10 DAY), 
 DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 6 DAY), 
 DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 8 DAY), 
 'returned');
