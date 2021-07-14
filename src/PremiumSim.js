// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: pink; icon-glyph: broadcast-tower;
// share-sheet-inputs: plain-text;



/*****************
Version 1.0.5

Changelog:
----------

Version 1.0.5:
	- Added alert to enter credentials and save it to the config file
	- Search in local and in iCloud storage for config and cache files
	- Fixed percent representation to one decimal place

Version 1.0.4:
	- Parse data from new designed homepage.

Version 1.0.3:
	- Added possibility to store credentials also in an external config on the iCloud Drive which is not being touched by updates.
	- Removed option to store credentials in the script itself.
	- Always reload data when started within scriptable app.

Version 1.0.2:
	- Added possibility to use other drillisch companies.

Version 1.0.1:
	- Fixed reading total inclusive amount.
	- Improved displaying of used amount.


If you have problems or need help, please ask for support here:
https://github.com/BergenSoft/scriptable_premiumsim


credits:
https://github.com/chaeimg/battCircle/blob/main/battLevel.js
*/


// ************************
// * CUSTOM CONFIGURATION *
// ************************
// How many minutes should the cache be used
let m_CacheMinutes = 60 * 4;

// Styles
const m_CanvSize = 200;
const m_CanvTextSize = 16;

const m_CanvFillColorMonth = '#EDEDED';
const m_CanvFillColorDataGood = '#1AE01A';
const m_CanvFillColorDataOK = '#E0E01A';
const m_CanvFillColorDataBad = '#E01A1A';
const m_CanvStrokeColor = '#121212'; // Circles background color
const m_CanvBackColor = '#242424';   // Widget background color
const m_CanvTextColor = '#FFFFFF';   // Text color (use same color as above to hide text)

// Dimensions of the circles
const m_CanvWidth = 9;
const m_CanvRadiusMonth = 80;
const m_CanvRadiusData = 70;


// ********************
// * GLOBAL VARIABLES *
// ********************

// Used to draw the circles
const m_Canvas = new DrawContext();
const m_forceReload = false;

// For processing the requests
let m_Cookies = { "isCookieAllowed": "true" };
let m_Sid = null;
let m_Csrf_token = null;

// Usage data
let m_Data = {
	bytes: 0,
	percent: 0,
	total: 0
};

// Used for comparing caching date and to calculate month progress
const m_Today = new Date();
const m_MonthStart = new Date(m_Today.getFullYear(), m_Today.getMonth(), 1);
const m_MonthEnd = new Date(m_Today.getFullYear(), m_Today.getMonth() + 1, 1);

// Set up the file manager.
const m_Filemanager = initFileManager();

// Set up cache
const m_ConfigRoot = m_Filemanager.joinPath(m_Filemanager.documentsDirectory(), Script.name());
const m_CachePath = m_Filemanager.joinPath(m_ConfigRoot, "cache.json");
console.log("Cache Path: " + m_CachePath);
const m_CacheExists = m_Filemanager.fileExists(m_CachePath)
const m_CacheDate = m_CacheExists ? m_Filemanager.modificationDate(m_CachePath) : 0

// Set up config
const m_ConfigFile = m_Filemanager.joinPath(m_ConfigRoot, "config.json");
if (!m_Filemanager.fileExists(m_ConfigFile))
{
	let alertBox = new Alert();
	alertBox.title = "Zugangsdaten";
	alertBox.message = "Bitte die Zugangsdaten eingeben.\nDie Daten werden standardmäßig in der iCloud abgespeichert.";
	alertBox.addAction("Speichern");
	alertBox.addCancelAction("Abbrechen");
	alertBox.addTextField("Benutzername");
	alertBox.addSecureTextField("Passwort");
	alertBox.addTextField("Provider", "premiumsim.de");
	let pressed = await alertBox.present();
	
	if (pressed === 0) // Save
	{
		const obj =
		{
			username: alertBox.textFieldValue(0),
			password: alertBox.textFieldValue(1),
			provider: alertBox.textFieldValue(2)
		};
		m_Filemanager.writeString(m_ConfigFile, JSON.stringify(obj));
		await m_Filemanager.downloadFileFromiCloud(m_ConfigFile);
	}
	else
	{
		throw new Error("No configuration found");
	}
}
else
{
	await m_Filemanager.downloadFileFromiCloud(m_ConfigFile);
}

console.log("Config Path: " + m_ConfigFile);

// Retrieve credentials
const config = JSON.parse(await m_Filemanager.readString(m_ConfigFile));
if (config === null)
{
	throw new Error("Failed to load configuration. Please delete or correct the file and run the script again.");
}

if (config.provider === null || config.provider === "")
	config.provider = "premiumsim.de";

// Use this to show the used credentials and provider
// console.log(config);

// Used URLS
let m_LoginPageUrl = "https://service." + config.provider;
let m_LoginUrl = "https://service." + config.provider + "/public/login_check";
let m_DataUsageUrl = "https://service." + config.provider + "/mytariff/invoice/showGprsDataUsage";

try
{
	// Reload data if script is running within scriptable app
	if (!config.runsInWidget || !m_CacheExists || (m_Today.getTime() - m_CacheDate.getTime()) > (m_CacheMinutes * 60 * 1000) || !loadDataFromCache())
	{
		// Load from website
		await prepareLoginData();
		await getDataUsage();
		saveDataToCache();
	}
}
catch (e)
{
	console.error(e);
	// Could not load from website, so load from cache
	loadDataFromCache();
}

await createWidget();
Script.complete();


async function getDataUsage()
{
	// Post login data
	let req = new Request(m_LoginUrl);
	req.method = 'POST';

	req.headers = {
		'Cookie': getCookiesString(),
		'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:72.0) Gecko/20100101 Firefox/72.0',
		'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
		'Content-Type': 'application/x-www-form-urlencoded',
		'Origin': m_LoginPageUrl,
		'Connection': 'keep-alive',
		'Referer': m_LoginPageUrl,
		'Upgrade-Insecure-Requests': '1',
		'TE': 'Trailers'
	};

	req.body = "_SID=" + m_Sid + "&UserLoginType%5Balias%5D=" + config.username + "&UserLoginType%5Bpassword%5D=" + config.password + "&UserLoginType%5Blogindata%5D=&UserLoginType%5Bcsrf_token%5D=" + m_Csrf_token;

	req.onRedirect = function (request)
	{
		return null;
	}

	var resp = await req.loadString();
	appendCookies(req.response.cookies);

	if (req.response.statusCode == 302 && req.response.headers["Location"] == "/start")
	{
		req = new Request(m_DataUsageUrl);

		req.headers = {
			'Cookie': getCookiesString(),
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:72.0) Gecko/20100101 Firefox/72.0',
			'Origin': m_LoginPageUrl,
			'Connection': 'keep-alive',
			'Referer': m_LoginPageUrl,
			'Upgrade-Insecure-Requests': '1',
			'TE': 'Trailers'
		};
		resp = await req.loadString();

		let dataInclusive = getSubstring(resp, ['class="dataBlob inclusive"', 'Inklusives Datenvolumen'], '</div>').trim();
		let dataUsageBytes = getSubstring(resp, ['class="dataBlob usage"', 'Inklusives Datenvolumen'], '</div>').trim();
		
		dataInclusive = dataInclusive.replace(",", ".").trim();
		dataUsageBytes = dataUsageBytes.replace(",", ".").trim();

		if (dataInclusive.indexOf('GB') !== -1)
			dataInclusive = parseInt(dataInclusive.substr(0, dataInclusive.length - 2));
		else if (dataInclusive.indexOf('MB') !== -1)
			dataInclusive = parseInt(dataInclusive.substr(0, dataInclusive.length - 2) / 1024);
		else if (dataInclusive.indexOf('KB') !== -1)
			dataInclusive = parseInt(dataInclusive.substr(0, dataInclusive.length - 2) / 1024 / 1024);
		else if (dataInclusive.indexOf('B') !== -1)
			dataInclusive = parseInt(dataInclusive.substr(0, dataInclusive.length - 1) / 1024 / 1024 / 1024);

		if (dataUsageBytes.indexOf('GB') !== -1)
			dataUsageBytes = parseFloat(dataUsageBytes.substr(0, dataUsageBytes.length - 2)) * 1024 * 1024 * 1024;
		else if (dataUsageBytes.indexOf('MB') !== -1)
			dataUsageBytes = parseFloat(dataUsageBytes.substr(0, dataUsageBytes.length - 2)) * 1024 * 1024;
		else if (dataUsageBytes.indexOf('KB') !== -1)
			dataUsageBytes = parseFloat(dataUsageBytes.substr(0, dataUsageBytes.length - 2)) * 1024;
		else if (dataUsageBytes.indexOf('B') !== -1)
			dataUsageBytes = parseFloat(dataUsageBytes.substr(0, dataUsageBytes.length - 1));

		let dataUsagePercent = Math.round(dataUsageBytes / (dataInclusive * 1024 * 1024 * 1024) * 1000) / 10; // round to 1 decimal place
		dataUsageBytes = parseInt(dataUsageBytes);

		m_Data.bytes = dataUsageBytes;
		m_Data.percent = dataUsagePercent;
		m_Data.total = dataInclusive;

		console.log(m_Data.total + " GB");
		console.log(dataUsageBytes);
		console.log(dataUsagePercent);
		return;
	}
}

async function prepareLoginData()
{
	// Get login page
	let req;
	req = new Request(m_LoginPageUrl);
	req.method = 'GET';
	req.headers = {
		'Cookie': getCookiesString(),
		'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:72.0) Gecko/20100101 Firefox/72.0',
		'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
		'Content-Type': 'application/x-www-form-urlencoded',
		'Connection': 'keep-alive',
		'Upgrade-Insecure-Requests': '1',
		'TE': 'Trailers'
	};

	var resp = await req.loadString();

	appendCookies(req.response.cookies);

	m_Csrf_token = getSubstring(resp, ['UserLoginType_csrf_token', 'value="'], "\"");

	// Get sid
	m_Sid = m_Cookies["_SID"];
}

function initFileManager()
{
	let fileManager = FileManager.local();
	let path = fileManager.joinPath(fileManager.documentsDirectory(), Script.name());
	if (fileManager.isDirectory(path))
	{
		console.log("Use local storage");
		return fileManager;
	}

	fileManager = FileManager.iCloud();
	path = fileManager.joinPath(fileManager.documentsDirectory(), Script.name());
	if (fileManager.isDirectory(path))
	{
		console.log("Use iCloud storage");
		return fileManager;
	}

	fileManager.createDirectory(path);

	try
	{
		console.log("Use iCloud storage");
		return FileManager.iCloud(); // Default FileManager on first start
	}
	catch (e)
	{
		console.log("Use local storage");
		// Error could ocour when iCloud is disabled
		return FileManager.local();
	}
}

function getCookiesString()
{
	let CookieValues = Object.entries(m_Cookies).map(function (v)
	{
		return v[0] + "=" + v[1];
	});

	result = CookieValues.join('; ');

	return result;
}

function appendCookies(newCookies)
{
	newCookies.map(function (v)
	{
		m_Cookies[v.name] = v.value;
		return null;
	});
}

function getSubstring(input, lookfor, lookUntil)
{
	lookfor.forEach(look =>
	{
		input = input.substr(input.indexOf(look) + look.length);
	});

	return input.substr(0, input.indexOf(lookUntil));
}

function saveDataToCache()
{
	try
	{
		m_Filemanager.writeString(m_CachePath, JSON.stringify(m_Data))
		return true;
	}
	catch (e)
	{
		console.warn("Could not create the cache file.")
		console.warn(e)
		return false;
	}
}

function loadDataFromCache()
{
	try
	{
		m_Data = JSON.parse(m_Filemanager.readString(m_CachePath));
		return true;
	}
	catch (e)
	{
		console.warn("Could not load the cache file.")
		console.warn(e)
		return false;
	}
}

async function createWidget()
{
	const wig = new ListWidget();

	m_Canvas.size = new Size(m_CanvSize, m_CanvSize);
	m_Canvas.respectScreenScale = true;

	let bgc = new Rect(0, 0, m_CanvSize, m_CanvSize);
	m_Canvas.setFillColor(new Color(m_CanvBackColor));
	m_Canvas.fill(bgc);

	const percentMonth = (m_Today.getTime() - m_MonthStart.getTime()) / (m_MonthEnd.getTime() - m_MonthStart.getTime());
	const fillColorData = (m_Data.percent / 100 <= percentMonth) ? m_CanvFillColorDataGood : ((m_Data.percent / 100 / 1.1 <= percentMonth) ? m_CanvFillColorDataOK : m_CanvFillColorDataBad);


	drawArc(
		new Point(m_CanvSize / 2, m_CanvSize / 2),
		m_CanvRadiusMonth,
		m_CanvWidth,
		percentMonth * 100 * 3.6,
		m_CanvFillColorMonth
	);
	drawArc(
		new Point(m_CanvSize / 2, m_CanvSize / 2),
		m_CanvRadiusData,
		m_CanvWidth,
		m_Data.percent * 3.6,
		fillColorData
	);

	const canvTextRectBytes = new Rect(
		0,
		m_CanvSize / 2 - m_CanvTextSize,
		m_CanvSize,
		m_CanvTextSize * 2
	);
	const canvTextRectPercent = new Rect(
		0,
		m_CanvSize / 2,
		m_CanvSize,
		m_CanvTextSize * 2
	);
	m_Canvas.setTextAlignedCenter();
	m_Canvas.setTextColor(new Color(m_CanvTextColor));
	m_Canvas.setFont(Font.boldSystemFont(m_CanvTextSize));
	if (m_Data.bytes < 100 * 1024 * 1024) // < 100 MB
	{
		m_Canvas.drawTextInRect(`${(m_Data.bytes / 1024 / 1024).toFixed(0)} MB / ${m_Data.total} GB`, canvTextRectBytes);
	}
	else if (m_Data.bytes < 1024 * 1024 * 1024) // < 1 GB
	{
		m_Canvas.drawTextInRect(`${(m_Data.bytes / 1024 / 1024 / 1024).toFixed(2)} GB / ${m_Data.total} GB`, canvTextRectBytes);
	}
	else
	{
		m_Canvas.drawTextInRect(`${(m_Data.bytes / 1024 / 1024 / 1024).toFixed(1)} GB / ${m_Data.total} GB`, canvTextRectBytes);
	}
	m_Canvas.drawTextInRect(`${m_Data.percent} %`, canvTextRectPercent);

	const canvImage = m_Canvas.getImage();
	wig.backgroundImage = canvImage;
	Script.setWidget(wig);
	Script.complete();
	await wig.presentSmall();
}


function sinDeg(deg)
{
	return Math.sin((deg * Math.PI) / 180);
}

function cosDeg(deg)
{
	return Math.cos((deg * Math.PI) / 180);
}

function drawArc(ctr, rad, w, deg, fillColor)
{
	let bgx = ctr.x - rad;
	let bgy = ctr.y - rad;
	let bgd = 2 * rad;
	let bgr = new Rect(bgx, bgy, bgd, bgd);

	m_Canvas.setFillColor(new Color(fillColor));
	m_Canvas.setStrokeColor(new Color(m_CanvStrokeColor));
	m_Canvas.setLineWidth(w);
	m_Canvas.strokeEllipse(bgr);

	for (t = 0; t < deg; t++)
	{
		rect_x = ctr.x + rad * sinDeg(t) - w / 2;
		rect_y = ctr.y - rad * cosDeg(t) - w / 2;
		rect_r = new Rect(rect_x, rect_y, w, w);
		m_Canvas.fillEllipse(rect_r);
	}
}
