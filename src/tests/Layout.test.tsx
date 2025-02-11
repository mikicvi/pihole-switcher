import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Layout from '../Layout';

describe('Layout', () => {
	const mockProps = {
		isDarkMode: false,
		handleThemeToggle: jest.fn(),
		piholeStatus: 'enabled',
		handleStatusClick: jest.fn(),
		handleLogoClick: jest.fn(),
		handleLogoHover: jest.fn(),
		handleLogoMouseLeave: jest.fn(),
		isLogoHovered: false,
		tooltipPosition: { top: 0, left: 0 },
		currentTheme: {},
		children: <div>Test children</div>,
	};

	const renderLayout = (props = mockProps) => {
		return render(
			<BrowserRouter>
				<Layout {...props} />
			</BrowserRouter>
		);
	};

	test('renders PiHole status correctly when enabled', () => {
		renderLayout();
		expect(screen.getByText('PiHole Enabled ✅'));
	});

	test('renders PiHole status correctly when disabled', () => {
		renderLayout({ ...mockProps, piholeStatus: 'disabled' });
		expect(screen.getByText('PiHole Disabled ❌'));
	});

	test('calls handleStatusClick when status is clicked', () => {
		renderLayout();
		fireEvent.click(screen.getByText('PiHole Enabled ✅'));
		expect(mockProps.handleStatusClick).toHaveBeenCalled();
	});

	test('shows navigation panel when menu button is clicked', () => {
		renderLayout();
		fireEvent.click(screen.getByText('☰'));
		expect(screen.getByText('Navigation'));
	});

	test('shows logo tooltip on hover', () => {
		renderLayout({ ...mockProps, isLogoHovered: true });
		expect(screen.getByText('Click to start ad blocking again.'));
	});

	test('calls logo event handlers', () => {
		renderLayout();
		const logo = screen.getByAltText('PiHole Logo');

		fireEvent.click(logo);
		expect(mockProps.handleLogoClick).toHaveBeenCalled();

		fireEvent.mouseEnter(logo);
		expect(mockProps.handleLogoHover).toHaveBeenCalled();

		fireEvent.mouseLeave(logo);
		expect(mockProps.handleLogoMouseLeave).toHaveBeenCalled();
	});

	test('renders navigation links', () => {
		renderLayout();
		fireEvent.click(screen.getByText('☰'));
		expect(screen.getByText('Home'));
		expect(screen.getByText('Filter List'));
	});

	test('renders theme toggle', () => {
		renderLayout();
		fireEvent.click(screen.getByText('☰'));
		expect(screen.getByText('Dark Mode'));
	});
});
