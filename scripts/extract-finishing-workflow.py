"""Read the supplied workbook; preserve source rows, missing values and painted bands."""
import json
import sys
from pathlib import Path
import openpyxl

workbook = openpyxl.load_workbook(sys.argv[1], data_only=True)
activities = []
for row in workbook['Sheet1'].iter_rows(min_row=3, max_row=91):
    number, name, duration, start, end, remarks = [cell.value for cell in row]
    phase = 0 if number <= 23 else 1 if number <= 43 else 2 if number <= 57 else 3 if number <= 69 else 4 if number <= 84 else 5
    activities.append(dict(id=f'elle-{number:03}', order=number, name=name.strip(), duration=duration,
                           phase=phase, remarks=remarks, source=f'Sheet1!A{row[0].row}:F{row[0].row}'))
sheet = workbook['Sheet2']
schedule = []
for row in range(4, 49):
    # Duration labels sometimes have a coloured fill too; exclude their merged cells.
    labels = set()
    annotations = []
    for col in range(4, 154):
        cell = sheet.cell(row, col)
        if cell.value is not None:
            annotations.append(f'{cell.coordinate}: {cell.value}')
            labels.add(col)
            for merged in sheet.merged_cells.ranges:
                if cell.coordinate in merged:
                    labels.update(range(merged.min_col, merged.max_col + 1))
    days = [col - 3 for col in range(4, 154) if col not in labels and sheet.cell(row, col).fill.patternType == 'solid']
    bands = []
    for day in days:
        if bands and day == bands[-1]['end'] + 1:
            bands[-1]['end'] = day
        else:
            bands.append(dict(start=day, end=day))
    schedule.append(dict(row=row, name=sheet.cell(row, 1).value.strip(), bands=bands, annotations=annotations,
                         source=f'Sheet2!A{row}:EW{row}'))
data = dict(source=Path(sys.argv[1]).name, phases=['Services & waterproofing', 'Interior base & flooring', 'External works', 'Finishes & joinery', 'Fixtures & commissioning', 'Snagging & handover'], activities=activities, schedule=schedule)
destination = Path(__file__).resolve().parents[1] / 'frontend/lib/finishing-workflow.json'
destination.write_text(json.dumps(data, indent=2), encoding='utf-8')
print(f'Extracted {len(activities)} activities and {len(schedule)} schedule rows from both sheets.')
