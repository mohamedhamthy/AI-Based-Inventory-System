export const sampleDataFields = () => ({
  dataOrigin: { type: String, enum: ['sample'], immutable: true },
  sampleDatasetId: { type: String, trim: true, immutable: true },
  sampleRecordKey: { type: String, trim: true, immutable: true },
});

export const addSampleDataIndex = (schema) => {
  schema.index(
    { workspaceId: 1, sampleDatasetId: 1, sampleRecordKey: 1 },
    {
      unique: true,
      partialFilterExpression: {
        sampleDatasetId: { $type: 'string' },
        sampleRecordKey: { $type: 'string' },
      },
    },
  );
};
