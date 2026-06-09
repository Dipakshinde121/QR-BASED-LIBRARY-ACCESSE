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
(5, 'BK-JSGP-505', 'JavaScript: The Good Parts', 'Douglas Crockford', 'Row 3, Shelf B', 'maintenance');

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
