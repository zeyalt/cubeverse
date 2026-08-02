-- Custom short label for an enrolled competitor, so the chart legend and
-- pill row don't have to show their full WCA name. NULL falls back to name.
alter table benchmark_competitors add column alias text;
