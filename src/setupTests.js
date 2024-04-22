require('dotenv').config();

// mock env variables
process.env.REACT_APP_PIHOLE_BASE = 'http://localhost';
process.env.REACT_APP_PIHOLE_KEY = 'asdfmock123key456';

module.exports = {
    setupFilesAfterEnv: ['@testing-library/jest-dom/extend-expect'],
};