# Crypto Bubbles Clone - Development Plan (Web Pivot)

## Context for the Agent
We are pivoting to a **web-first** implementation to ship quickly and deploy on Vercel. The goal stays the same: visualize cryptocurrency market data as a packed bubble chart.
- **Framework:** Next.js (App Router) + TypeScript
- **Visuals:** Bubbles sized by Market Cap, colored by 24h Performance (Green positive, Red negative).
- **Backend:** Vercel native (Postgres if available) with localStorage fallback for favorites.

---

## Step 1: Project Skeleton & API Layer
**Prompt:**
"Create the foundational structure for the app.
1.  **Navigation:** Set up `expo-router` with a Tabs layout:
    * `index.tsx` (Home/Bubbles)
    * `favorites.tsx` (Saved Coins)
    * `settings.tsx` (Options)
2.  **API Service:** Create `services/coingecko.ts`.
    * Function: `fetchMarketData()`
    * Endpoint: `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false`
    * Return type should include: `id`, `symbol`, `current_price`, `price_change_percentage_24h`, `market_cap`, `image`.
3.  **State:** create a simple Context or Zustand store to hold this data so it's accessible globally."

---

## Step 2: The Bubble Chart Engine (Visuals)
**Prompt:**
"Implement the Bubble Chart component in `components/BubbleChart.tsx`.
1.  **Imports:** Use `d3-hierarchy` (specifically `pack`) and `react-native-svg` (`Svg`, `Circle`, `Text`, `G`).
2.  **Logic:**
    * Input: Array of coin data.
    * Process: Use `d3.pack()` to calculate x, y, and radius for each coin based on `market_cap`.
    * Dimensions: The chart should fill the screen width and height.
3.  **Rendering:**
    * Render a `<Circle>` for each coin.
    * **Fill Color:** If `price_change_percentage_24h` >= 0, use `#00b853` (Green). If < 0, use `#d32f2f` (Red).
    * **Labels:** Add a white `<Text>` centered in the bubble showing the `symbol` (uppercase).
    * **Interaction:** Wrap each bubble in a `Pressable` (or use SVG `onPress`). On press, show an Alert with the coin name and price."

---

## Step 3: "Exceptional" Features (Sensors & Search)
**Prompt:**
"Add the 'Exceptional' features required for the grade:
1.  **Shake to Refresh:**
    * Use `expo-sensors` (Accelerometer).
    * In `index.tsx`, listen for a shake gesture (acceleration > 1.5).
    * When shaken, trigger `fetchMarketData()` again and vibrate the phone (`Vibration.vibrate()`).
2.  **Filter/Search:**
    * Add a Search Bar at the top of the Home screen.
    * Filter the data passed to `BubbleChart` based on the search text."

---

## Step 4: AWS Amplify Backend (Database)
**Prompt:**
"Configure the AWS Amplify Gen 2 backend.
1.  **Schema:** Write the code for `amplify/data/resource.ts`.
    * Define a model `FavoriteCoin` with fields: `symbol` (string), `name` (string), `addedAt` (datetime).
    * Allow public access for now (apiKey).
2.  **Integration:**
    * In `app/_layout.tsx`, configure the Amplify provider.
    * In `favorites.tsx`, use `generateClient` to list the saved favorites from the database.
    * Update `BubbleChart.tsx`: On a long-press of a bubble, save that coin to the `FavoriteCoin` database table."

---

## Step 5: Final Polish (UI Match)
**Prompt:**
"Polish the UI to match the 'Crypto Bubbles' vibe:
1.  **Background:** Set the app background to a dark charcoal (`#1a1a1a`).
2.  **Top Bar:** Create a custom header that looks like the screenshots (Hour/Day/Week tabs - visual only).
3.  **Animations:** Add a simple layout animation (FadeIn) when the bubbles first appear."
