'use strict';

var _fs = require('fs');

var _url = require('url');

var _url2 = _interopRequireDefault(_url);

var _2 = require('../');

var _fp = require('lodash/fp');

var _fp2 = _interopRequireDefault(_fp);

var _asyncp = require('asyncp');

var _asyncp2 = _interopRequireDefault(_asyncp);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

let debug = (0, _debug2.default)('pdk:inventory');
const IDP_URI = process.env.IDP_URI || 'https://accounts.pdk.io';

(async function () {
  // Connect to the panel and itemize asset info
  // Panel => InventoriedPanel
  const inventoryPanel = _fp2.default.curry(async (authsession, { id, name, uri }) => {
    // Create an authentication session to the panel's API
    const panelsession = (0, _2.makePanelSession)(authsession, { id, uri });

    // Get the list of configured devices
    let connected = false;
    let devices = [];
    try {
      devices = await panelsession('devices');
      connected = true;
    } catch (err) {
      //console.log('Unable to negotiate session with panel', err);
    }

    console.log(`${id}: online ${connected} devices ${devices.length}`);

    // Return what we found of the panel inventory
    return {
      id,
      name,
      connected,
      deviceCount: devices.length,
      devices
    };
  });

  // Recursively processes asset info for every panel in an OU and its children OUs
  // OU => InventoriedOU
  const inventoryOu = _fp2.default.curry(async (authsession, ouId) => {
    const ou = await (0, _2.getOu)(authsession, ouId);

    console.log(`${ou.name}: panels ${ou.panels.length} children ${ou.children.length}`);

    // Return the inventoried OU
    return {
      name: ou.name,
      owner: ou.owner,
      // Inventory each panel in the OU
      panels: await _asyncp2.default.map(ou.panels, inventoryPanel(authsession)),
      // Recurse to inventory any children of this OU
      children: await _asyncp2.default.map(ou.children, _fp2.default.compose(inventoryOu(authsession), ou => ou.id))
    };
  });

  try {
    let authsession = await (0, _2.makeSession)((0, _2.clientauth)({
      client_id: process.env.PDK_CLIENT_ID,
      client_secret: process.env.PDK_CLIENT_SECRET,
      issuer: IDP_URI
    }), _url2.default.resolve(IDP_URI, `api/`));

    // OU pseudo id 'mine' is the authenticated user's root organization
    const assets = await inventoryOu(authsession, 'mine');

    // Write the inventory out to a file
    (0, _fs.writeFile)('./inventory.json', JSON.stringify(assets, null, 2), 'utf-8');
  } catch (err) {
    debug(`Error retrieving inventory: ${err.message}`);
  }
})();