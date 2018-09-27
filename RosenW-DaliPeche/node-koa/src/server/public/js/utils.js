async function exportToExcel (event, filters, reportName) {
  event.preventDefault();
  const uri = 'data:data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,';
  const template = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head></head><body><table>{table}</table></body></html>';

  const base64 = (s) => {
    return window.btoa(unescape(encodeURIComponent(s)))
  };

  const format = (s, c) => {
    return s.replace(/{(\w+)}/g, (m, p) => {
        return c[p];
    });
  }

  const filterTable = document.createElement('table');

  const filterHeaders = ['Filter', 'Value'];

  const thRow = document.createElement('tr');

  for (const header of filterHeaders) {
    const th = document.createElement('th');

    th.innerHTML = header;

    thRow.appendChild(th);
    filterTable.appendChild(thRow);
  }

  for (const [key, value] of Object.entries(filters)) {
    const row = document.createElement('tr');
    const tdName = document.createElement('td');
    const tdVal = document.createElement('td');

    tdName.innerHTML = key;
    tdVal.innerHTML = value;

    row.appendChild(tdName);
    row.appendChild(tdVal);

    filterTable.appendChild(row);
  }

  const response = await fetch(`/admin/xlsx/${reportName}`, {
    headers: {
      "Content-Type": "application/json"
    },
    method : "POST",
    body: JSON.stringify({ filters })
  });
  const data = await response.json();
  const htmls = `${filterTable.innerHTML}<tr></tr>${data.table}`;

  console.log(htmls);

  const ctx = {
    worksheet : 'Worksheet',
    table : htmls
  }

  const link = document.createElement("a");
  link.download = `${reportName}-report-${new Date().toISOString()}.xlsx`;
  link.href = uri + base64(format(template, ctx));
  link.click();
}
