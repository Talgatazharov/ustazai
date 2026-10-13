const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const email = process.env.DEMO_EMAIL;
  const password = process.env.DEMO_PASSWORD;
  if (!email || !password || password.length < 10) throw new Error('Set DEMO_EMAIL and DEMO_PASSWORD (at least 10 characters) before seeding.');
  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    create: { email: email.toLowerCase(), name: 'Талғат Ажаров', passwordHash: await hash(password, 12), role: 'TEACHER', profile: { create: { school: 'Демо мектеп', subject: 'Информатика', academicYear: '2026–2027', onboardingDone: true } } },
    update: {}
  });
  const subject = await prisma.subject.upsert({ where: { name: 'Информатика' }, create: { name: 'Информатика' }, update: {} });
  for (const name of ['7А', '8Б', '9А']) {
    const grade = Number(name[0]);
    const schoolClass = await prisma.class.upsert({
      where: { teacherId_name_academicYear: { teacherId: user.id, name, academicYear: '2026–2027' } },
      create: { teacherId: user.id, name, grade, letter: name.slice(1), academicYear: '2026–2027', subjectId: subject.id },
      update: {}
    });
    const count = await prisma.student.count({ where: { classId: schoolClass.id } });
    if (!count) {
      const names = ['Аружан Нұрланқызы','Айбек Серікұлы','Данияр Ермекұлы','Әли Омаров','Мадина Қайратқызы','Нұрай Асқарқызы','Іңкәр Бақытқызы','Ерасыл Мұратұлы'];
      await prisma.student.createMany({ data: names.map(studentName => ({ teacherId: user.id, classId: schoolClass.id, name: studentName })) });
    }
  }
  console.log('Demo teacher and classes seeded.');
}
main().finally(() => prisma.$disconnect()).catch(error => { console.error(error.message); process.exit(1); });
