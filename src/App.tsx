import React, { useEffect, useState, useCallback } from 'react';
import {
	Toggle,
	Dropdown,
	IDropdownOption,
	initializeIcons,
	ThemeProvider,
} from '@fluentui/react';
import './App.css';
import { darkTheme, lightTheme } from './themes/themes';
import Graph from './Graph';
import Filterlist from './Filterlist';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Layout from './Layout';
import PiholeApi from './services/piholeApi';

initializeIcons(); // Initialize Fluent UI icons

const PiholeSwitcher: React.FC = () => {
	const [selectedTime, setSelectedTime] = useState<string | undefined>(
		undefined
	);
	const [toggleOn, setToggleOn] = useState<boolean>(false);
	const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
	const [timeLeft, setTimeLeft] = useState<any>(null);
	const [piholeStatus, setPiholeStatus] = useState<string>('false');
	const [timer, setTimer] = useState<any>(null);
	const [isLogoHovered, setIsLogoHovered] = useState<boolean>(false);
	const [tooltipPosition, setTooltipPosition] = useState<any>({
		top: 0,
		left: 0,
	});

	const timeOptions: IDropdownOption[] = [
		{ key: '300', text: '5 minutes' },
		{ key: '900', text: '15 minutes' },
		{ key: '3600', text: '60 minutes' },
		{ key: '86400', text: '24 hours' },
	];

	const [piholeApi] = useState(() => {
		const baseUrl =
			process.env.REACT_APP_PIHOLE_BASE ??
			(window as any)._env_.REACT_APP_PIHOLE_BASE;
		return PiholeApi.getInstance(baseUrl);
	});

	const handleTimeSelect = (
		event: React.FormEvent<HTMLDivElement>,
		item?: IDropdownOption
	): void => {
		if (item) setSelectedTime(item.key as string);
	};

	const fetchStatus = useCallback(async (): Promise<void> => {
		try {
			const status = await piholeApi.getStatus();
			setPiholeStatus(status);
			if (status === 'enabled') {
				setTimer(0);
				setToggleOn(false);
			}
		} catch (error) {
			console.error('Status Fetch Error:', error);
		}
	}, [piholeApi]);

	const toggleSwitch = async (): Promise<void> => {
		if (selectedTime) {
			try {
				await piholeApi.disable(selectedTime);
				setToggleOn(true);
				// Start a timer to update timeLeft
				let timeLeft = parseInt(selectedTime);
				setTimer(
					setInterval(() => {
						timeLeft--;
						if (timeLeft <= 0) {
							clearInterval(timer);
							setToggleOn(false);
						}
						setTimeLeft(prettyPrintTime(timeLeft)); // Update the timeLeft state
					}, 1000)
				);
			} catch (error) {
				console.error('Switch API Error:', error);
			}
		}
	};

	function prettyPrintTime(seconds: number): string {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds - hours * 3600) / 60);
		const secondsLeft = seconds - hours * 3600 - minutes * 60;
		return `${hours}h ${minutes}m ${secondsLeft}s`;
	}

	const handleThemeToggle = () => {
		setIsDarkMode(!isDarkMode);
	};
	const handleStatusClick = () => {
		window.open(piholeApi.getAdminUrl());
	};
	const handleLogoClick = async () => {
		await piholeApi.enable();
		setIsLogoHovered(false);
		clearInterval(timer);
		setTimeLeft(0);
	};

	const handleLogoHover = (event: React.MouseEvent<HTMLImageElement>) => {
		const { clientX, clientY } = event;
		setTooltipPosition({ top: clientY + 15, left: clientX + 100 });
		setIsLogoHovered(true);
	};

	const handleLogoMouseLeave = () => {
		setIsLogoHovered(false);
	};

	// Define the theme based on the isDarkMode state
	const currentTheme = isDarkMode ? darkTheme : lightTheme;

	useEffect(() => {
		let intervalId: NodeJS.Timeout;
		fetchStatus();

		// Use shorter intervals in test environment
		const isTest = process.env.NODE_ENV === 'test';

		if (isTest) {
			// Use 3 second intervals for tests
			intervalId = setInterval(fetchStatus, 3000);
		} else if (piholeStatus === 'disabled') {
			intervalId = setInterval(fetchStatus, 30000); // 30 seconds when disabled
		} else {
			intervalId = setInterval(fetchStatus, 60000); // 60 seconds when enabled
		}

		return () => clearInterval(intervalId);
	}, [fetchStatus, piholeStatus]);

	useEffect(() => {
		return () => {
			// Cleanup on unmount
			piholeApi.destroy();
		};
	}, [piholeApi]);

	return (
		<Router>
			<ThemeProvider applyTo="body" theme={currentTheme}>
				<Routes>
					<Route
						path="/"
						element={
							<Layout
								isDarkMode={isDarkMode}
								handleThemeToggle={handleThemeToggle}
								piholeStatus={piholeStatus}
								handleStatusClick={handleStatusClick}
								handleLogoClick={handleLogoClick}
								handleLogoHover={handleLogoHover}
								handleLogoMouseLeave={handleLogoMouseLeave}
								isLogoHovered={isLogoHovered}
								tooltipPosition={tooltipPosition}
								currentTheme={currentTheme}
							>
								<p>
									Choose for how long you want to disable the
									ad blocking service:
								</p>
								<Dropdown
									options={timeOptions}
									selectedKey={selectedTime}
									onChange={handleTimeSelect}
									placeholder="Select time"
									label="Disable Ad Blocking"
								/>
								<div
									style={{
										display: 'flex',
										justifyContent: 'space-between',
										alignItems: 'center',
									}}
								>
									<Toggle
										className="switch"
										checked={toggleOn}
										onChange={toggleSwitch}
									/>

									{toggleOn && timeLeft !== null && (
										<p
											className="timer"
											style={{ margin: 0 }}
										>
											Time left: {timeLeft} seconds
										</p>
									)}
								</div>
								<Graph />
							</Layout>
						}
					/>
					<Route
						path="/filterlist"
						element={
							<Layout
								isDarkMode={isDarkMode}
								handleThemeToggle={handleThemeToggle}
								piholeStatus={piholeStatus}
								handleStatusClick={handleStatusClick}
								handleLogoClick={handleLogoClick}
								handleLogoHover={handleLogoHover}
								handleLogoMouseLeave={handleLogoMouseLeave}
								isLogoHovered={isLogoHovered}
								tooltipPosition={tooltipPosition}
								currentTheme={currentTheme}
							>
								<Filterlist />
							</Layout>
						}
					/>
				</Routes>
			</ThemeProvider>
		</Router>
	);
};

export default PiholeSwitcher;
