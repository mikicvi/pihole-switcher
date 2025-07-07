// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import axios from 'axios';
require('dotenv').config();

// mock env variables
process.env.REACT_APP_PIHOLE_BASE = 'http://localhost';
process.env.REACT_APP_PIHOLE_PASSWORD = 'asdfmock123key456';
// Set a flag to indicate we're in a test environment
process.env.NODE_ENV = 'test';

// Setting test environment to jsdom programmatically
// This is supported by CRA without ejecting
global.testEnvironment = 'jsdom';

// Mock window.open for testing
window.open = jest.fn();

// Setup window._env_ for tests that access env vars through window
if (!window._env_) {
	window._env_ = {
		REACT_APP_PIHOLE_BASE: 'http://localhost',
		REACT_APP_PIHOLE_PASSWORD: 'asdfmock123key456',
	};
}
