/* Server-side pagination is owned by each page module. This compatibility file no longer
 * overrides window.fetch or watches the entire DOM, which previously caused unnecessary
 * work and could overwrite an explicitly requested page number. */
(()=>{'use strict';window.LARGE_LIST_PAGINATION={state:{}};})();