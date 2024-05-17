import React, { useEffect, useState, useCallback } from 'react';
import {
	Toggle,
	Dropdown,
	IDropdownOption,
	initializeIcons,
	ThemeProvider,
} from '@fluentui/react';
import axios from 'axios';
import './App.css';
import piholeLogo from './images/pihole.png';
import { darkTheme, lightTheme } from './themes/themes';
import Graph from './Graph';

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

	const piHolebaseUrl =
		process.env.REACT_APP_PIHOLE_BASE ||
		(window as any)._env_.REACT_APP_PIHOLE_BASE;
	const piHoleApiKey =
		process.env.REACT_APP_PIHOLE_KEY ||
		(window as any)._env_.REACT_APP_PIHOLE_KEY;

	const handleTimeSelect = (
		event: React.FormEvent<HTMLDivElement>,
		item?: IDropdownOption
	): void => {
		if (item) setSelectedTime(item.key as string);
	};

	const fetchStatus = useCallback(async (): Promise<void> => {
		let queryString = `${piHolebaseUrl}api.php?status&auth=${piHoleApiKey}`;
		try {
			let status = await axios.get(queryString);
			if (status.data.status === 'enabled') {
				// Compare as a string
				setPiholeStatus('enabled'); // Set it as a string
				setTimer(0);
				setToggleOn(false);
			} else {
				setPiholeStatus('disabled'); // Set it as a string
			}
		} catch (error) {
			console.error('Status Fetch Error:', error);
		}
	}, [piHoleApiKey, piHolebaseUrl]);

	const toggleSwitch = async (): Promise<void> => {
		if (selectedTime) {
			try {
				await axios.get(
					`${piHolebaseUrl}api.php?disable=${selectedTime}&auth=${piHoleApiKey}`
				);
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
		window.open(piHolebaseUrl);
	};
	const handleLogoClick = () => {
		axios.get(`${piHolebaseUrl}api.php?enable&auth=${piHoleApiKey}`);
		setIsLogoHovered(false);
		clearInterval(timer);
		setTimeLeft(0);
	};

	const handleLogoHover = (event: React.MouseEvent<HTMLImageElement>) => {
		const { clientX, clientY } = event;
		setTooltipPosition({ top: clientY + 15, left: clientX + 100 });
	};

	// Define the theme based on the isDarkMode state
	const currentTheme = isDarkMode ? darkTheme : lightTheme;

	useEffect(() => {
		fetchStatus();
		// Set up an interval to fetch status every 3 seconds
		const intervalId = setInterval(fetchStatus, 3000);
		return () => clearInterval(intervalId);
	}, [fetchStatus]);

	return (
		<div className="container">
			<ThemeProvider applyTo="body" theme={currentTheme}>
				<div className="flex-container">
					<div className="flex-child box1">
						{piholeStatus === 'enabled' ? (
							<span
								role="img"
								aria-label="Enabled"
								onClick={handleStatusClick}
								style={{ color: 'green' }}
							>
								PiHole Enabled ✅
							</span>
						) : (
							<span
								role="img"
								about="Disabled"
								onClick={handleStatusClick}
								style={{ color: 'red' }}
							>
								PiHole Disabled ❌
							</span>
						)}
					</div>
					<div className="flex-child box2">
						<div className="componentAlignRight">
							<Toggle
								offText="Light Mode"
								onClick={handleThemeToggle}
							/>
						</div>
					</div>
				</div>
				<img
					src={piholeLogo}
					alt="PiHole Logo"
					className="logo"
					onClick={handleLogoClick}
					onMouseEnter={() => setIsLogoHovered(true)}
					onMouseMove={(event) => handleLogoHover(event)}
					onMouseLeave={() => setIsLogoHovered(false)}
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
				<p>
					Choose for how long you want to disable the ad blocking
					service:
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
						<p className="timer" style={{ margin: 0 }}>
							Time left: {timeLeft} seconds
						</p>
					)}
				</div>
				<Graph />
			</ThemeProvider>
		</div>
	);
};
export default PiholeSwitcher;
