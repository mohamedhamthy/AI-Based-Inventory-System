export const withoutTestOwnership = (fields = {}) => {
  const safeFields = { ...fields };
  delete safeFields.testSuite;
  delete safeFields.testRunId;
  return safeFields;
};
