
const objectToSet = (obj) => {
  const values = Object.values(obj);
  return new Set(values);
}

export { objectToSet };
