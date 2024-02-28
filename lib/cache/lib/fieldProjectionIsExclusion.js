export default (fields) => {
  for (const value in fields) {
    if (fields[value] !== 1) {
      return true
    }
  }
}
