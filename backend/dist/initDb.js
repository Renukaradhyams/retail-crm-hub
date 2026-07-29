"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDb = initDb;
const db_1 = require("./config/db");
async function initDb() {
    const conn = await db_1.pool.getConnection();
    try {
        // 1. Settings
        await conn.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        id INT PRIMARY KEY DEFAULT 1,
        company_name VARCHAR(80) NOT NULL DEFAULT 'BSC Retail',
        logo_url VARCHAR(500),
        open_hour TINYINT NOT NULL DEFAULT 10,
        close_hour TINYINT NOT NULL DEFAULT 22,
        footfall_grace_minutes INT NOT NULL DEFAULT 30,
        edit_cutoff_hours INT NOT NULL DEFAULT 3,
        der_email VARCHAR(255),
        der_whatsapp_note TEXT,
        tv_pin VARCHAR(10) NOT NULL DEFAULT '9911',
        cash_pin VARCHAR(10) NOT NULL DEFAULT '1938',
        greeter_pin VARCHAR(10) NOT NULL DEFAULT '4567',
        setup_complete TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
        // 2. Users
        await conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(80) NOT NULL DEFAULT '',
        role ENUM('super_admin','admin','crm_manager','crm_staff','telecaller','purchase_manager','vm','greeter') NOT NULL DEFAULT 'crm_staff',
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
        // 3. Sections
        await conn.execute(`
      CREATE TABLE IF NOT EXISTS sections (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        name VARCHAR(80) NOT NULL,
        section_type ENUM('floor','counter','department') NOT NULL DEFAULT 'floor',
        manager VARCHAR(80),
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // 4. FootfallEntry
        await conn.execute(`
      CREATE TABLE IF NOT EXISTS footfall_entries (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        entry_date DATE NOT NULL,
        slot_hour TINYINT NOT NULL,
        visitors INT NOT NULL DEFAULT 0,
        remarks VARCHAR(160),
        submitted_by VARCHAR(36),
        submitted_by_name VARCHAR(80),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_date_slot (entry_date, slot_hour)
      )
    `);
        // 5. DailySummary
        await conn.execute(`
      CREATE TABLE IF NOT EXISTS daily_summaries (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        entry_date DATE NOT NULL UNIQUE,
        bills_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
        // 6. FeedbackQuestion
        await conn.execute(`
      CREATE TABLE IF NOT EXISTS feedback_questions (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        question TEXT NOT NULL,
        options JSON NOT NULL,
        position INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // 7. Feedback
        await conn.execute(`
      CREATE TABLE IF NOT EXISTS feedback (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        entry_date DATE NOT NULL,
        customer_name VARCHAR(80) NOT NULL,
        mobile VARCHAR(15),
        dob DATE,
        section_id VARCHAR(36),
        section_name VARCHAR(80),
        answers JSON,
        voice TEXT,
        source ENUM('qr','staff') NOT NULL DEFAULT 'qr',
        is_negative TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // 8. CallQueue
        await conn.execute(`
      CREATE TABLE IF NOT EXISTS call_queue (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        feedback_id VARCHAR(36),
        entry_date DATE NOT NULL,
        customer_name VARCHAR(80) NOT NULL,
        mobile VARCHAR(15),
        section_name VARCHAR(80),
        call_type VARCHAR(50) NOT NULL DEFAULT 'negative_feedback',
        status ENUM('new','called','resolved','escalated') NOT NULL DEFAULT 'new',
        notes TEXT,
        attempts INT NOT NULL DEFAULT 0,
        escalated TINYINT(1) NOT NULL DEFAULT 0,
        follow_up_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
        // 9. DivertReasons
        await conn.execute(`
      CREATE TABLE IF NOT EXISTS divert_reasons (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        code VARCHAR(50) NOT NULL UNIQUE,
        label VARCHAR(120) NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1
      )
    `);
        // 10. Diverts
        await conn.execute(`
      CREATE TABLE IF NOT EXISTS diverts (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        ref_no INT AUTO_INCREMENT UNIQUE,
        entry_date DATE NOT NULL,
        section_id VARCHAR(36),
        section_name VARCHAR(80),
        product_wanted TEXT NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        price_range VARCHAR(80),
        fabric_occasion VARCHAR(160),
        reason_code VARCHAR(50),
        customer_name VARCHAR(80) NOT NULL,
        customer_mobile VARCHAR(15) NOT NULL,
        expected_delivery DATE,
        status ENUM('open','sourcing','available','closed','cancelled') NOT NULL DEFAULT 'open',
        pm_notes TEXT,
        created_by VARCHAR(36),
        created_by_name VARCHAR(80),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
        // 11. DivertUpdates
        await conn.execute(`
      CREATE TABLE IF NOT EXISTS divert_updates (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        divert_id VARCHAR(36) NOT NULL,
        status ENUM('open','sourcing','available','closed','cancelled'),
        note TEXT,
        actor_id VARCHAR(36),
        actor_name VARCHAR(80),
        actor_role VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (divert_id) REFERENCES diverts(id) ON DELETE CASCADE
      )
    `);
        // 12. CashSettlements
        await conn.execute(`
      CREATE TABLE IF NOT EXISTS cash_settlements (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        entry_date DATE NOT NULL UNIQUE,
        sale_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        bills_count INT NOT NULL DEFAULT 0,
        cash_total DECIMAL(12,2) NOT NULL DEFAULT 0,
        card_total DECIMAL(12,2) NOT NULL DEFAULT 0,
        upi_total DECIMAL(12,2) NOT NULL DEFAULT 0,
        submitted_by VARCHAR(36),
        submitted_by_name VARCHAR(80),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
        // 13. CashCounterReports
        await conn.execute(`
      CREATE TABLE IF NOT EXISTS cash_counter_reports (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        settlement_id VARCHAR(36) NOT NULL,
        counter_name VARCHAR(80) NOT NULL,
        cashier_name VARCHAR(80),
        bills_count INT NOT NULL DEFAULT 0,
        sale_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        cash_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        card_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        upi_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        staff_discount DECIMAL(12,2) NOT NULL DEFAULT 0,
        customer_discount DECIMAL(12,2) NOT NULL DEFAULT 0,
        FOREIGN KEY (settlement_id) REFERENCES cash_settlements(id) ON DELETE CASCADE
      )
    `);
        // 14. VM Checklist Points
        await conn.execute(`
      CREATE TABLE IF NOT EXISTS vm_checklist_points (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        title VARCHAR(200) NOT NULL,
        description TEXT,
        section VARCHAR(80),
        position INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // 15. VM Submissions
        await conn.execute(`
      CREATE TABLE IF NOT EXISTS vm_submissions (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        entry_date DATE NOT NULL,
        shift ENUM('opening','mid_day','closing') NOT NULL DEFAULT 'opening',
        floor VARCHAR(80),
        score_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
        submitted_by VARCHAR(36),
        submitted_by_name VARCHAR(80),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // 16. VM Submission Entries
        await conn.execute(`
      CREATE TABLE IF NOT EXISTS vm_submission_entries (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        submission_id VARCHAR(36) NOT NULL,
        point_id VARCHAR(36),
        point_title VARCHAR(200),
        score ENUM('pass','fail','na') NOT NULL DEFAULT 'na',
        remarks TEXT,
        photo_url VARCHAR(500),
        FOREIGN KEY (submission_id) REFERENCES vm_submissions(id) ON DELETE CASCADE
      )
    `);
        // 17. Shifts
        await conn.execute(`
      CREATE TABLE IF NOT EXISTS shifts (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        name VARCHAR(80) NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // 18. Attendance Records
        await conn.execute(`
      CREATE TABLE IF NOT EXISTS attendance_records (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        entry_date DATE NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        shift_id VARCHAR(36),
        status ENUM('present','absent','late','half_day','leave','week_off') NOT NULL DEFAULT 'present',
        check_in DATETIME,
        check_out DATETIME,
        worked_minutes INT NOT NULL DEFAULT 0,
        remarks TEXT,
        marked_by VARCHAR(36),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_attendance (entry_date, user_id)
      )
    `);
        // 19. Roster Entries
        await conn.execute(`
      CREATE TABLE IF NOT EXISTS roster_entries (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        entry_date DATE NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        shift_id VARCHAR(36),
        notes TEXT,
        created_by VARCHAR(36),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_roster (entry_date, user_id)
      )
    `);
        console.log('✅ Database tables verified/created');
    }
    finally {
        conn.release();
    }
}
