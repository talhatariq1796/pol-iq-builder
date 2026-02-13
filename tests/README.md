# Comprehensive Pipeline Test Suite

This test suite provides comprehensive validation of the entire query-to-visualization pipeline before manual browser testing. It ensures that all components work correctly together and catches issues that would otherwise manifest during manual testing.

## 🎯 Test Coverage

### 1. Query Routing Tests (`tests/routing/`)
- Tests all 14 active ANALYSIS_CATEGORIES (42 total queries)
- Validates semantic enhancement for complex queries
- Tests multi-target detection and routing
- Verifies confidence scores and thresholds
- Performance benchmarks for routing speed

### 2. Processor Integration Tests (`tests/unit/`)
- Tests all 35+ active processors can initialize properly
- Verifies disabled technical processors are truly disabled
- Tests processor configuration loading
- Validates real estate context awareness
- Error handling for processor failures

### 3. Data Pipeline Tests (`tests/integration/`)
- Tests frontend cache data loading
- Verifies field mapping and extraction
- Tests clustering service integration
- Validates FSA boundary handling
- Data quality validation

### 4. Visualization Pipeline Tests (`tests/integration/`)
- Tests map rendering without actual browser
- Verifies popup content generation
- Tests legend creation
- Validates ArcGIS integration points
- Performance testing for visualization components

### 5. Performance Tests (`tests/performance/`)
- Tests caching system performance
- Benchmark query processing times
- Validates memory usage stays reasonable
- Tests concurrent query handling
- Resource utilization monitoring

### 6. Error Handling Tests (`tests/e2e/`)
- Tests malformed queries (14 different scenarios)
- Tests missing data scenarios
- Tests processor failures and recovery
- Tests timeout handling
- System recovery testing

### 7. Configuration Tests (`tests/unit/`)
- Tests UnifiedConfigurationManager
- Verifies field mappings are consistent
- Tests real estate context loading
- Configuration performance validation
- Security validation

## 🚀 Running the Tests

### Quick Start
```bash
# Run all pipeline tests
npm run test:pipeline

# Run tests in parallel (faster)
npm run test:pipeline:parallel

# Run only high-priority tests (critical functionality)
npm run test:pipeline:high-priority

# Generate HTML report
npm run test:pipeline:html

# Run without coverage (faster)
npm run test:pipeline:no-coverage
```

### Individual Test Suites
```bash
# Query routing validation
npx jest tests/routing/query-routing-validation.test.ts

# Processor integration
npx jest tests/unit/processor-integration.test.ts

# Data pipeline validation
npx jest tests/integration/data-pipeline-validation.test.ts

# Visualization pipeline
npx jest tests/integration/visualization-pipeline.test.ts

# System performance
npx jest tests/performance/system-performance.test.ts

# Error handling
npx jest tests/e2e/error-handling.test.ts

# Configuration validation
npx jest tests/unit/configuration-validation.test.ts
```

## 📊 Test Results and Reporting

### Console Output
The test runner provides detailed console output including:
- Summary statistics (passed/failed/success rate)
- Performance metrics (average times, slowest/fastest suites)
- Coverage information (statements/branches/functions/lines)
- Detailed results for each test suite
- Error details for failed tests

### HTML Reports
Generate HTML reports with:
```bash
npm run test:pipeline:html
```
Reports are saved to `tests/reports/pipeline-test-report.html`

### JSON Reports
Detailed JSON reports are automatically saved to `tests/reports/` with timestamps.

## 🏗️ Architecture

### Test Runner (`tests/run-comprehensive-pipeline-tests.ts`)
- Coordinates all test suites
- Provides parallel and sequential execution
- Generates comprehensive reports
- Handles timeouts and error recovery
- Integrates with Claude Flow hooks

### Mock Components (`tests/mocks/`)
- `visualization-mocks.ts` - Mock ArcGIS and visualization components
- `analysis-mocks.ts` - Mock analysis engines and cache managers
- `processor-mocks.ts` - Mock data processors with realistic behavior

### Test Setup (`tests/setup.ts`)
- Configures Jest environment
- Sets up global mocks
- Handles test timeouts
- Manages test cleanup

## ⚙️ Configuration

### Jest Configuration (`jest.config.pipeline-tests.js`)
- TypeScript support with ts-jest
- 5-minute timeout for complex tests
- Coverage collection from lib/ and components/
- Mock setup and teardown
- Parallel test execution

### Environment Variables
- `NODE_ENV=test` - Test environment flag
- `DEBUG_TESTS=true` - Enable debug console output
- `JEST_TIMEOUT=300000` - 5-minute timeout

## 🎯 Test Priorities

### Priority 1 (Critical - Must Pass)
- Query Routing Validation
- Processor Integration  
- Configuration Validation

### Priority 2 (Important)
- Data Pipeline Validation
- Visualization Pipeline
- Error Handling

### Priority 3 (Performance)
- System Performance Tests

## 🔧 Troubleshooting

### Common Issues

**Timeout Errors:**
```bash
# Increase timeout for specific test
npx jest tests/performance/ --testTimeout=600000
```

**Memory Issues:**
```bash
# Run with more memory
NODE_OPTIONS='--max-old-space-size=4096' npm run test:pipeline
```

**Debug Mode:**
```bash
# Enable debug output
DEBUG_TESTS=true npm run test:pipeline
```

### Test Failures

**High Priority Test Failures:**
- These indicate critical system issues
- Must be resolved before manual testing
- Check console output for specific error details

**Performance Test Failures:**
- May indicate system resource constraints
- Check memory usage and CPU utilization
- Consider running with fewer parallel processes

**Error Handling Test Failures:**
- Verify error handling is graceful
- Check that fallback mechanisms work
- Ensure user-facing error messages are clear

## 📈 Performance Benchmarks

### Expected Performance Metrics
- **Query Routing**: < 3 seconds per query
- **Processor Initialization**: < 5 seconds per processor
- **Data Loading**: < 2 seconds for typical datasets
- **Visualization Rendering**: < 10 seconds for complex visualizations
- **Cache Operations**: > 100 reads/sec, > 50 writes/sec
- **Memory Usage**: < 150MB increase during normal operations

### Monitoring
The test suite tracks and reports:
- Execution times for all operations
- Memory usage patterns
- Cache hit/miss ratios
- Error recovery times
- Resource utilization

## 🔄 Integration with Development Workflow

### Pre-Manual Testing Checklist
1. Run `npm run test:pipeline:high-priority` - Must pass 100%
2. Run `npm run test:pipeline` - Should pass > 90%
3. Check HTML report for detailed results
4. Review performance metrics
5. Verify error handling coverage

### Continuous Integration
The test suite is designed to run in CI environments:
- All dependencies are mocked or stubbed
- No browser or external service dependencies
- Deterministic results
- Comprehensive error reporting

### Development Feedback Loop
1. Make code changes
2. Run relevant test subset
3. Fix any failures
4. Run full pipeline test suite
5. Review performance impact
6. Proceed to manual testing

This comprehensive test suite ensures that the query-to-visualization pipeline is robust, performant, and ready for manual browser testing.