# Approximate locality search

`australian-areas.json` contains locality name, postcode, state and approximate latitude/longitude from Matthew Proctor's community-sourced Australian postcode database, downloaded 25 September 2026.

Source: https://github.com/matthewproctor/australianpostcodes/blob/master/australian_postcodes.csv
Publisher and free-download description: https://www.matthewproctor.com/australian_postcodes

Only the original `lat`/`long` locality coordinates are used, not the separately supplied Google-derived precise coordinates. Rows with missing/out-of-Australia coordinates, duplicate locality/postcode/state tuples and labelled PO-box/LVR records are excluded. The data is approximate and not a guarantee of postal/address accuracy. It is used for selecting a search area, never for a venue's directions or entrance. Multiple localities sharing a postcode are shown as choices.
