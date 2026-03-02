import bcrypt from 'bcrypt';
const password = 'Admin123!'; // the password you want
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) throw err;
  console.log('Hashed password:', hash);
});
