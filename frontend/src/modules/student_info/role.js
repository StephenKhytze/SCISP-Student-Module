// login saves the account in localStorage, role is Student / Teacher / Admin
function user() {
  try {
    return JSON.parse(localStorage.getItem('user'));
  } catch {
    return null;
  }
}

export function myRole() {
  return user()?.role || 'Student';
}

// add, archive, logs and export are admin only in the use case diagram
export function isAdmin() {
  return myRole() === 'Admin';
}

// the last part of the username is the student number
// (DelaCruz_Juan_C1234 -> C1234). that is the id we ask the api for.
export function myStudentNumber() {
  return user()?.username?.split('_').pop() || null;
}
