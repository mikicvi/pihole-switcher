import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './App.css';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { useTheme, Pivot, PivotItem } from '@fluentui/react';

ChartJS.register(ArcElement, Tooltip, Legend);

interface Response {
	top_queries: string[];
	top_ads: string[];
}

const piHolebaseUrl =
	process.env.REACT_APP_PIHOLE_BASE ||
	(window as any)._env_.REACT_APP_PIHOLE_BASE;
const piHoleApiKey =
	process.env.REACT_APP_PIHOLE_KEY ||
	(window as any)._env_.REACT_APP_PIHOLE_KEY;

const Graph: React.FC = () => {
	const theme = useTheme();
	const [apiData, setApiData] = useState<any>(null);
	const [adsGraphData, setAdsGraphData] = useState<any>(null);
	const [queriesGraphData, setQueriesGraphData] = useState<any>(null);
	const [selectedTab, setSelectedTab] = useState('topAds');

	const tabStyle = {
		color: theme.palette.neutralPrimary,
		fontWeight: 'bold',
	};

	// read in the data from the API
	const fetchData = async () => {
		try {
			const adsData = await axios.get<Response>(
				`${piHolebaseUrl}api.php?topItems&auth=${piHoleApiKey}`
			);
			setApiData(adsData.data);
		} catch (error) {
			console.error('Error:', error);
		}
	};

	useEffect(() => {
		fetchData();
	}, []);

	useEffect(() => {
		if (apiData) {
			const aGraphData = {
				labels: Object.keys(apiData.top_ads || {}),
				datasets: [
					{
						data: Object.values(apiData.top_ads || {}),
						backgroundColor: [
							'rgba(255, 99, 132, 0.2)',
							'rgba(255, 159, 64, 0.2)',
							'rgba(255, 205, 86, 0.2)',
							'rgba(75, 192, 192, 0.2)',
							'rgba(54, 162, 235, 0.2)',
							'rgba(153, 102, 255, 0.2)',
						],
						borderColor: [
							'rgb(255, 99, 132)',
							'rgb(255, 159, 64)',
							'rgb(255, 205, 86)',
							'rgb(75, 192, 192)',
							'rgb(54, 162, 235)',
							'rgb(153, 102, 255)',
						],
						borderWidth: 1,
						padding: 100,
					},
				],
			};
			setAdsGraphData(aGraphData);
		}
	}, [apiData]);

	useEffect(() => {
		if (apiData) {
			const qGraphData = {
				labels: Object.keys(apiData.top_queries || {}),
				datasets: [
					{
						data: Object.values(apiData.top_queries || {}),
						backgroundColor: [
							'rgba(255, 99, 132, 0.2)',
							'rgba(255, 159, 64, 0.2)',
							'rgba(255, 205, 86, 0.2)',
							'rgba(75, 192, 192, 0.2)',
							'rgba(54, 162, 235, 0.2)',
							'rgba(153, 102, 255, 0.2)',
						],
						borderColor: [
							'rgb(255, 99, 132)',
							'rgb(255, 159, 64)',
							'rgb(255, 205, 86)',
							'rgb(75, 192, 192)',
							'rgb(54, 162, 235)',
							'rgb(153, 102, 255)',
						],
						borderWidth: 1,
						padding: 100,
					},
				],
			};
			setQueriesGraphData(qGraphData);
		}
	}, [apiData]);

	return (
		<div className="pie-chart-container-ads">
			<Pivot
				className="tablist"
				aria-label="Chart Tabs"
				selectedKey={selectedTab}
				onLinkClick={(item?: PivotItem) => {
					if (item) {
						setSelectedTab(item.props.itemKey ?? 'topAds');
					}
				}}
			>
				<PivotItem
					headerText="Top Ads"
					itemKey="topAds"
					className={`tab ${
						selectedTab === 'topAds' ? 'active' : ''
					}`}
					style={tabStyle}
				/>
				<PivotItem
					headerText="Top Queries"
					itemKey="topQueries"
					className={`tab ${
						selectedTab === 'topQueries' ? 'active' : ''
					}`}
					style={tabStyle}
				/>
			</Pivot>
			<hr />
			{selectedTab === 'topAds' && adsGraphData && (
				<Pie data={adsGraphData} />
			)}
			{selectedTab === 'topQueries' && queriesGraphData && (
				<Pie data={queriesGraphData} />
			)}
		</div>
	);
};
export default Graph;
