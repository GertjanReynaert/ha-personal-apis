import { LoaderFunction } from 'remix';
import * as cheerio from 'cheerio';

const CALENDAR_HOME_PAGE = 'https://www.waregemexpo.be/kalender/';

const mapableResults = (html: any) => {
  const amountOfItems = html.length;

  return Array.from({ length: amountOfItems }, (_, index) => html[index]);
};

const getImageSourceFromElement = (element: cheerio.Cheerio) =>
  element.attr('src') ?? null;
const getTextFromElement = (element: cheerio.Cheerio) => element.text().trim();

/**
 * Takes date string of dd/mm/yyyy format and returns a UTC date
 */
const processDate = (stringDate: string) => {
  if (!stringDate) return null;

  const [day, month, year] = stringDate.trim().slice(3).split('/');
  const comprehensibleFormat = `${year}-${month}-${day}T00:00:00Z`;
  return new Date(comprehensibleFormat);
};

const scrape = async () => {
  const calendarResponse = await fetch(CALENDAR_HOME_PAGE);
  const calendar = await calendarResponse.text();
  const calendarHTML = cheerio.load(calendar);

  const yearsHTML = calendarHTML('#kalender-overzicht ul.archief-dates a');
  const years = mapableResults(yearsHTML).map((year) => ({
    year: year.children[0].data,
    url: year.attribs.href,
  }));

  const results = await Promise.all(
    years.map(async ({ year, url }) => {
      const yearCalendarResponse = await fetch(url);
      const yearCalendar = await yearCalendarResponse.text();
      const yearCalendarHTML = cheerio.load(yearCalendar);

      const events = mapableResults(
        yearCalendarHTML('a.kalender-evenementt-rij')
      );
      const parsedEvents = events.map((event) => {
        const eventHTML = cheerio.load(event);

        const [startString, endString] = getTextFromElement(
          eventHTML('.media .media-body h4')
        )
          .trim()
          .split('tot');

        return {
          imageUrl: getImageSourceFromElement(
            eventHTML('.media .media-left img')
          ),
          startDate: processDate(startString),
          endDate: processDate(endString),
          title: getTextFromElement(eventHTML('.media .media-body h1')),
          description: getTextFromElement(eventHTML('.media .media-body p')),
          detailUrl: event.attribs.href,
          slug: event.attribs.href.split('/')[4],
        };
      });

      return {
        [year]: parsedEvents,
      };
    })
  );

  return results.reduce((acc, year) => ({ ...acc, ...year }));
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
