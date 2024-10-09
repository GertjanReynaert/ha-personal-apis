import { json } from '@remix-run/node';
import * as cheerio from 'cheerio';

const HOME_PAGE = 'https://www.essevee.be/nl';

// @ts-expect-error unknown cheerio type for html
const getTextFromElement = (element: cheerio.Cheerio) => element.text().trim();

const getMonthFromAbbreviation = (monthAbbreviation: string) => {
	const months = {
		januari: 1,
		februari: 2,
		maart: 3,
		april: 4,
		mei: 5,
		juni: 6,
		juli: 7,
		augustus: 8,
		september: 9,
		oktober: 10,
		november: 11,
		december: 12,
	} as const;

	const defaultMonth = Object.keys(months)[0];
	const month = (Object.keys(months).find((key) =>
		key.startsWith(monthAbbreviation.toLowerCase())
	) ?? defaultMonth) as keyof typeof months;
	return months[month];
};

const padValue = (value: string | number, length: number = 2) =>
	String(value).padStart(length, '0');

/**
 * Takes date string of 20 okt - 16:00 format and returns a UTC date
 */
const processDate = (stringDate: string) => {
	if (!stringDate) return null;

	const [date, time] = stringDate.split('-').map((s) => s.trim());
	const [dayRaw, monthString] = date.split(' ');
	const monthRaw = getMonthFromAbbreviation(monthString);
	const [hourRaw, minuteRaw] = time.split(':');

	const year = new Date().getFullYear();
	const month = padValue(monthRaw);
	const day = padValue(dayRaw);
	const hour = padValue(hourRaw);
	const minute = padValue(minuteRaw);

	const comprehensibleFormat = `${year}-${month}-${day}T${hour}:${minute}:00Z`;
	return new Date(comprehensibleFormat);
};

const scrape = async () => {
	const response = await fetch(HOME_PAGE);
	const responseText = await response.text();
	const responseHTML = cheerio.load(responseText);

	const nextMatchDateAndTime = getTextFromElement(
		responseHTML(
			'div.home-news-match > div > div:nth-child(2) > div > div > div.px-6.py-7.border-b.text-center > p > span.font-bold.uppercase'
		)
	);
	const nextMatchCompetition = getTextFromElement(
		responseHTML(
			'div.home-news-match > div > div:nth-child(2) > div > div > div.px-6.py-7.border-b.text-center > p > span.opacity-70'
		)
	);

	const nextMatchHomeTeam = getTextFromElement(
		responseHTML(
			'div.home-news-match > div > div:nth-child(2) > div > div > div.relative.px-6.pt-9.pb-9.flex.justify-between > div:nth-child(1) > p'
		)
	);
	const nextMatchAwayTeam = getTextFromElement(
		responseHTML(
			'div.home-news-match > div > div:nth-child(2) > div > div > div.relative.px-6.pt-9.pb-9.flex.justify-between > div:nth-child(3) > p'
		)
	);

	return {
		nextMatch: {
			date: processDate(nextMatchDateAndTime),
			competition: nextMatchCompetition,
			homeTeam: nextMatchHomeTeam,
			awayTeam: nextMatchAwayTeam,
		},
		calendar: [],
	};
};

export const loader = async () => {
	const scrapedData = await scrape();

	return json(scrapedData);
};
