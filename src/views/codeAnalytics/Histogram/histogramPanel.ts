import { AnalyticsProvider, DurationRecord } from "../../../services/analyticsProvider";
import { Settings } from "../../../settings";

export class HistogramPanel {

    jsArrayP50: string;
    jsArrayP95: string;

    constructor(private _analyticsProvider: AnalyticsProvider){
        this.jsArrayP50="";
        this.jsArrayP95="";

    }
    
    private durationRecordToJS(durationRecord: DurationRecord[]):string{

        const firstRecord = durationRecord.firstOrDefault();
        let date='';
        if (firstRecord){
            const r=firstRecord.time;
            date+=`new Date(${r.year()}, ${r.month()}, ${r.day()}, ${r.hours()}, ${r.minutes()},${r.seconds()}, ${r.milliseconds()})`;
            let durations = durationRecord.map(x=>x.duration.toString()).join(",");
            return `[${date} ,${durations}] `;
        }
        return '';

    }
    public async loadData(spanName: string, instrumentationLibrary: string, 
        codeObjectId: string){

        const histogramData = await this._analyticsProvider.getSpanHistogram(spanName, instrumentationLibrary,
            codeObjectId, Settings.environment.value);
        
        let rows:string[]=[];
        for (let i=0; i< histogramData.p50Durations.length; i++ ){

            rows.push(this.durationRecordToJS([histogramData.p50Durations[i],histogramData.p95Durations[i]]));
        }

        this.jsArrayP50=rows.join(",");

        //this.jsArrayP95= histogramData.p95Durations.map(x=>this.durationRecordToJS(x)).join(",");

    }
    public getHtml():string{
        const html =  `
        <head>
            <script src="https://www.gstatic.com/charts/loader.js"></script>
            <script>
            google.charts.load('current', {packages: ['corechart', 'line']});
            google.charts.setOnLoadCallback(drawChart);

                function drawChart() {
                // Define the   chart to be drawn.
                var data = new google.visualization.DataTable();
                data.addColumn('date', 'Time');
                data.addColumn('number', 'P50');
                data.addColumn('number', 'P95');


                data.addRows([
                    ${this.jsArrayP50}
                ]);

                var options = {
                    hAxis: {
                      title: 'Time'
                    },
                    vAxis: {
                      title: 'Duration'
                    },
                    colors: ['#AB0D06', '#007329'],
                    trendlines: {
                      0: {type: 'exponential', color: '#333', opacity: 1},
                      1: {type: 'linear', color: '#111', opacity: .3}
                    }
                  };

                // Instantiate and draw the chart.
                var chart = new google.visualization.LineChart(document.getElementById('myPieChart'));
                chart.draw(data, options);
                }
            </script>
            </head>
            <body>
            <!-- Identify where the chart should be drawn. -->
            <div id="myPieChart"/>
            </body>

        `;

        return html;

    }
}
    