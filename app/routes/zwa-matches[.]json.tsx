import { LoaderFunction } from 'remix';
import * as cheerio from 'cheerio';

const HOME_PAGE = 'https://www.essevee.be/nl';

const getTextFromElement = (element: cheerio.Cheerio) => element.text().trim();

const getMonthFromAbbreviation = (monthAbbreviation: string) => {
	const months = {
		januari: 0,
		februari: 1,
		maart: 2,
		april: 3,
		mei: 4,
		juni: 5,
		juli: 6,
		augustus: 7,
		september: 8,
		oktober: 9,
		november: 10,
		december: 11,
	} as const;

	const defaultMonth = Object.keys(months)[0];
	const month = (Object.keys(months).find((key) =>
		key.startsWith(monthAbbreviation.toLowerCase())
	) ?? defaultMonth) as keyof typeof months;
	return months[month];
};

const padValue = (value: string | number, length: number = 2) =>
	String(value).padStart(2, '0');

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

export const loader: LoaderFunction = async () => {
	const parsedEvents = await scrape();
	const json = JSON.stringify(parsedEvents);

	return new Response(json, {
		headers: {
			'Cache-Control': `public, max-age=${60 * 10}, s-maxage=${60 * 60 * 24}`,
			'Content-Type': 'application/json',
			'Content-Length': String(Buffer.byteLength(json)),
		},
	});
};
