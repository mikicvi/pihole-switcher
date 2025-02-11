import React, { useState } from 'react';
import {
	Toggle,
	ThemeProvider,
	Panel,
	PanelType,
	DefaultButton,
} from '@fluentui/react';
import { Link } from 'react-router-dom';
import piholeLogo from './images/pihole.png';

interface LayoutProps {
	isDarkMode: boolean;
	handleThemeToggle: () => void;
	piholeStatus: string;
	handleStatusClick: () => void;
	handleLogoClick: () => void;
	handleLogoHover: (event: React.MouseEvent<HTMLImageElement>) => void;
	handleLogoMouseLeave: () => void;
	isLogoHovered: boolean;
	tooltipPosition: { top: number; left: number };
	currentTheme: any;
	children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({
	isDarkMode,
	handleThemeToggle,
	piholeStatus,
	handleStatusClick,
	handleLogoClick,
	handleLogoHover,
	handleLogoMouseLeave,
	isLogoHovered,
	tooltipPosition,
	currentTheme,
	children,
}) => {
	const [isNavOpen, setIsNavOpen] = useState(false);

	const toggleNav = () => {
		setIsNavOpen(!isNavOpen);
	};

	return (
		<ThemeProvider applyTo="body" theme={currentTheme}>
			<div className="container">
				<div className="flex-container">
					<div className="flex-child box1">
						{piholeStatus === 'enabled' ? (
							<span
								role="img"
								aria-label="Enabled"
								onClick={handleStatusClick}
								style={{
									color: 'green',
									fontSize: '18px',
									cursor: 'pointer',
								}}
							>
								PiHole Enabled ✅
							</span>
						) : (
							<span
								role="img"
								aria-label="Disabled"
								onClick={handleStatusClick}
								style={{
									color: 'red',
									fontSize: '18px',
									cursor: 'pointer',
								}}
							>
								PiHole Disabled ❌
							</span>
						)}
					</div>
					<div className="flex-child box2">
						<div className="componentAlignRight">
							<DefaultButton
								className="nav-toggle"
								onClick={toggleNav}
								styles={{
									root: {
										maxHeight: '15px',
										minWidth: '10px',
										fontSize: '14px',
									},
								}}
							>
								☰
							</DefaultButton>
						</div>
					</div>
				</div>
				<img
					src={piholeLogo}
					alt="PiHole Logo"
					className="logo"
					onClick={handleLogoClick}
					onMouseEnter={handleLogoHover}
					onMouseMove={handleLogoHover}
					onMouseLeave={handleLogoMouseLeave}
				/>
				{isLogoHovered && (
					<div
						className="logoHoverText"
						style={{
							top: tooltipPosition.top,
							left: tooltipPosition.left,
						}}
					>
						Click to start ad blocking again.
					</div>
				)}
				<Panel
					isOpen={isNavOpen}
					onDismiss={toggleNav}
					type={PanelType.custom}
					customWidth="250px"
					isLightDismiss
					closeButtonAriaLabel="Close"
					headerText="Navigation"
					className="nav-panel"
				>
					<nav>
						<Link to="/">
							<DefaultButton
								text="Home"
								className="nav-button"
								onClick={toggleNav}
							/>
						</Link>
						<Link to="/filterlist">
							<DefaultButton
								text="Filter List"
								className="nav-button"
								onClick={toggleNav}
							/>
						</Link>
					</nav>
					<div className="theme-toggle">
						<Toggle
							label="Dark Mode"
							checked={isDarkMode}
							onChange={handleThemeToggle}
							onText="Dark"
							offText="Light"
						/>
					</div>
				</Panel>
				{children}
			</div>
		</ThemeProvider>
	);
};

export default Layout;
