import { initDb } from './initDb';
import { query, queryOne } from './config/db';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('🌱 Seeding database...');
  await initDb();

  // 1. Initial Settings
  await query(`
    INSERT INTO settings (id, company_name, open_hour, close_hour, setup_complete)
    VALUES (1, 'BSC Retail', 10, 22, 1)
    ON DUPLICATE KEY UPDATE company_name=VALUES(company_name)
  `);

  // 2. Default Divert Reasons
  const defaultReasons = [
    { code: 'SIZE_UNAVAILABLE', label: 'Size Unavailable' },
    { code: 'COLOR_UNAVAILABLE', label: 'Color Unavailable' },
    { code: 'DESIGN_OUT_OF_STOCK', label: 'Design Out of Stock' },
    { code: 'PRICE_TOO_HIGH', label: 'Price Expectations' },
    { code: 'FABRIC_PREFERENCE', label: 'Fabric/Material Preference' },
  ];

  for (const r of defaultReasons) {
    await query(`
      INSERT INTO divert_reasons (id, code, label)
      VALUES (UUID(), ?, ?)
      ON DUPLICATE KEY UPDATE label=VALUES(label)
    `, [r.code, r.label]);
  }

  // 3. Default Feedback Questions
  const defaultQuestions = [
    {
      question: 'Would you recommend BSC Retail to your friends and family?',
      options: ['Yes', 'Maybe', 'No'],
      position: 1,
    },
    {
      question: 'How was the service provided by our store staff?',
      options: ['Excellent', 'Good', 'Average', 'Poor'],
      position: 2,
    },
    {
      question: 'Did you find the variety and stock options sufficient?',
      options: ['Yes', 'No'],
      position: 3,
    },
  ];

  const qCount = await queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM feedback_questions');
  if (!qCount || qCount.cnt === 0) {
    for (const q of defaultQuestions) {
      await query(`
        INSERT INTO feedback_questions (id, question, options, position)
        VALUES (UUID(), ?, ?, ?)
      `, [q.question, JSON.stringify(q.options), q.position]);
    }
  }

  // 4. Default VM Checklist Points
  const defaultVmPoints = [
    { title: 'Entrance mannequin styling & lighting', section: 'Ground Floor', position: 1 },
    { title: 'Main aisle display cleanliness & fold alignment', section: 'Ground Floor', position: 2 },
    { title: 'Price tag & promotional board accuracy', section: 'All Floors', position: 3 },
    { title: 'Trial room cleanliness and hanger clearing', section: 'Trial Rooms', position: 4 },
  ];

  const vmCount = await queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM vm_checklist_points');
  if (!vmCount || vmCount.cnt === 0) {
    for (const p of defaultVmPoints) {
      await query(`
        INSERT INTO vm_checklist_points (id, title, section, position)
        VALUES (UUID(), ?, ?, ?)
      `, [p.title, p.section, p.position]);
    }
  }

  // 5. Default Shifts
  const defaultShifts = [
    { name: 'Morning Shift', start_time: '10:00:00', end_time: '19:00:00' },
    { name: 'Evening Shift', start_time: '13:00:00', end_time: '22:00:00' },
    { name: 'Full Day Shift', start_time: '10:00:00', end_time: '22:00:00' },
  ];

  const shiftCount = await queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM shifts');
  if (!shiftCount || shiftCount.cnt === 0) {
    for (const s of defaultShifts) {
      await query(`
        INSERT INTO shifts (id, name, start_time, end_time)
        VALUES (UUID(), ?, ?, ?)
      `, [s.name, s.start_time, s.end_time]);
    }
  }

  console.log('✅ Seeding complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
