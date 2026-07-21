const coverageReportConfig = {
  test: {
    coverage: {
      thresholds: {
        branches: 80,
        functions: 88,
        lines: 85,
        statements: 85,
      },
    },
  },
};

const coverageThresholds = coverageReportConfig.test.coverage.thresholds;

export { coverageThresholds };
export default coverageReportConfig;
