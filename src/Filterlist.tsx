import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
	Dropdown,
	IDropdownOption,
	TextField,
	PrimaryButton,
	MessageBar,
	MessageBarType,
	DetailsList,
	DetailsListLayoutMode,
	IColumn,
	SelectionMode,
	Stack,
	IStackTokens,
	IDetailsListStyles,
} from '@fluentui/react';

const Filterlist: React.FC = () => {
	const [listType, setListType] = useState<'whitelist' | 'blacklist'>(
		'whitelist'
	);
	const [list, setList] = useState<
		{ domain: string; date_modified: number; status: boolean }[]
	>([]);
	const [newDomain, setNewDomain] = useState<string>('');
	const [isError, setIsError] = useState<boolean>(false);
	const [error, setError] = useState<string>('');
	const [isSuccess, setIsSuccess] = useState<boolean>(false);
	const [currentPage, setCurrentPage] = useState<number>(1);

	const piHoleApiKey =
		process.env.REACT_APP_PIHOLE_KEY ??
		(window as any)._env_.REACT_APP_PIHOLE_KEY;
	const piholeBaseUrl =
		process.env.REACT_APP_PIHOLE_BASE ??
		(window as any)._env_.REACT_APP_PIHOLE_BASE;

	const stackTokens: IStackTokens = { childrenGap: 15 };
	const detailsListStyles: Partial<IDetailsListStyles> = {
		root: {
			marginTop: 20,
			marginBottom: 20,
		},
	};

	const listApiMap = {
		whitelist: 'white',
		blacklist: 'black',
	};

	const columns: IColumn[] = [
		{
			key: 'domain',
			name: 'Domain Name',
			fieldName: 'domain',
			minWidth: 100,
			maxWidth: 190,
			isResizable: true,
		},
		{
			key: 'status',
			name: 'Status',
			fieldName: 'status',
			minWidth: 50,
			maxWidth: 70,
			isResizable: true,
			onRender: (item) => (
				<span style={{ color: item.status ? 'green' : 'red' }}>
					{item.status ? 'Enabled' : 'Disabled'}
				</span>
			),
		},
		{
			key: 'dateModified',
			name: 'Date Modified',
			fieldName: 'date_modified',
			minWidth: 100,
			maxWidth: 200,
			isResizable: true,
			onRender: (item) =>
				new Date(item.date_modified * 1000).toLocaleString(),
		},
	];

	const queryString = (listType: keyof typeof listApiMap, domain?: string) =>
		`${piholeBaseUrl}api.php?list=${listApiMap[listType]}${
			domain ? `&add=${domain}` : ''
		}&auth=${piHoleApiKey}`;

	const fetchList = async () => {
		try {
			const response = await axios.get(
				`${piholeBaseUrl}api.php?list=${listApiMap[listType]}&auth=${piHoleApiKey}`
			);
			const data = response.data.data;
			if (Array.isArray(data)) {
				const domains = data.map((item: any) => ({
					domain: item.domain,
					date_modified: item.date_modified,
					status: item.enabled,
				}));
				setList(domains.reverse());
			} else {
				setList([]);
			}
			setIsError(false);
		} catch (error) {
			setIsError(true);
			setError('Failed to fetch list');
		}
	};

	useEffect(() => {
		fetchList();
	}, [listType]);

	const isValidDomain = (domain: string): boolean => {
		const domainRegex = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
		return domainRegex.test(domain);
	};

	const handleAddDomain = async () => {
		if (!newDomain) {
			setIsError(true);
			setError('Domain cannot be empty');
			return;
		}

		if (!isValidDomain(newDomain)) {
			setIsError(true);
			setError('Please enter a valid domain (e.g., example.com)');
			return;
		}

		try {
			const response = await axios.get(queryString(listType, newDomain));
			if (
				response.data.success &&
				response.data.message.includes('already on the list')
			) {
				setIsError(true);
				setError('This domain is already in the list');
				return;
			}

			setList([
				{
					domain: newDomain,
					date_modified: Date.now() / 1000,
					status: true,
				},
				...list,
			]);
			setNewDomain('');
			setIsError(false);
			setIsSuccess(true);
			setTimeout(() => setIsSuccess(false), 3000);
		} catch (error) {
			setIsError(true);
			setError('Failed to add domain to list');
		}
	};

	const handleListTypeChange = (
		event: React.FormEvent<HTMLDivElement>,
		option?: IDropdownOption
	) => {
		if (option) {
			setListType(option.key as 'whitelist' | 'blacklist');
		}
	};

	const listOptions: IDropdownOption[] = [
		{ key: 'whitelist', text: 'Whitelist' },
		{ key: 'blacklist', text: 'Blacklist' },
	];

	const itemsPerPage = 5;
	const totalPages = Math.ceil(list.length / itemsPerPage);
	const paginatedList = list.slice(
		(currentPage - 1) * itemsPerPage,
		currentPage * itemsPerPage
	);

	return (
		<div className="container">
			<header className="header">
				<h1>
					{listType === 'whitelist'
						? 'Filter List: Whitelist'
						: 'Filter List: Blacklist'}
				</h1>
			</header>
			<main>
				<Stack tokens={stackTokens}>
					<Dropdown
						options={listOptions}
						selectedKey={listType}
						onChange={handleListTypeChange}
						placeholder="Select list type"
						label="Select List Type"
					/>
					<TextField
						value={newDomain}
						onChange={(e, newValue) => setNewDomain(newValue || '')}
						placeholder="Enter domain"
						label="Domain"
						errorMessage={isError ? error : undefined}
					/>
					<PrimaryButton onClick={handleAddDomain} text="Add" />

					{isSuccess && (
						<MessageBar messageBarType={MessageBarType.success}>
							Domain added successfully
						</MessageBar>
					)}

					{isError && (
						<MessageBar messageBarType={MessageBarType.error}>
							{error}
						</MessageBar>
					)}

					<DetailsList
						items={paginatedList}
						columns={columns}
						setKey="set"
						layoutMode={DetailsListLayoutMode.justified}
						selectionMode={SelectionMode.none}
						styles={detailsListStyles}
						compact={true}
					/>

					{totalPages > 1 && (
						<Stack
							horizontal
							horizontalAlign="center"
							tokens={stackTokens}
						>
							{Array.from({ length: totalPages }, (_, i) => (
								<PrimaryButton
									key={i}
									text={(i + 1).toString()}
									onClick={() => setCurrentPage(i + 1)}
									primary={currentPage === i + 1}
								/>
							))}
						</Stack>
					)}
				</Stack>
			</main>
		</div>
	);
};

export default Filterlist;
