import { stringify } from "querystring";
import { AnalyticsProvider, DurationRecord } from "../../../services/analyticsProvider";
import { Settings } from "../../../settings";
import { SpanInfo } from "../InsightListView/CommonInsightObjects";

export class HistogramPanel {



    constructor(private _analyticsProvider: AnalyticsProvider){

    }
    
    private durationRecordToJS(durationRecord: DurationRecord):string{

        let date='';
        const r=durationRecord.time;
        const d = new Date(r.toISOString());
        date+=`[new Date(]${r.year()}, ${r.month()}, ${d.getDate()}, ${r.hours()}, ${r.minutes()},${r.seconds()},${r.milliseconds()})`;
        let durations = (durationRecord.duration/1000000).toPrecision(2).toString();
        return `{x: ${date},y: ${durations}}`;
        

    }

    private getXAxisData(durationRecords: DurationRecord[]):string{
        var dateStrings = durationRecords.map(x=>x.time).map(d=>{
            return `'${d.format('YYYY-MM-DD HH:mm:SS')}'`;
        }).join(",");
        return `[${dateStrings}]`;
    }

    private getYAxisData(durationRecords: DurationRecord[]):string{
        const durations = durationRecords.map(x=>x.duration)
            .map(d=>(d/1000000).toPrecision(2).toString()).join(",");
        return `[${durations}]`;
    }

    public async getHtml(spanName: string, instrumentationLibrary: string, 
        codeObjectId: string):Promise<string>{

        
        const histogramData = await this._analyticsProvider.getSpanHistogramData(spanName, instrumentationLibrary,
            codeObjectId, Settings.environment.value);
        
        let dataByPercentile = histogramData.percentileDurations.groupBy(x=>x.percentile);
        let percentiles = Object.keys(dataByPercentile);
        let dataSources: string[] = [];

        for (const percentile of percentiles){
            let p = parseFloat(percentile);
            let percentileData = dataByPercentile[p];

            const xValues = this.getXAxisData(percentileData);
            const yValues = this.getYAxisData(percentileData);

            dataSources.push(`
                    {
                        type: "scatter",
                        name: 'P${(p*100).toString()}',
                        x: ${xValues},
                        y: ${yValues},
                        line: {color: '#7F7F7F'}
                    }
            `);
        }

        const data = `[${dataSources.join(",")}]`;

        
        const html =  `
        <head>
        <div id="chartContainer" style="height: 370px; width: 100%;"></div>
        <!-- Load plotly.js into the DOM -->
        <script src='https://cdn.plot.ly/plotly-2.12.1.min.js'></script>
        <script src='https://cdnjs.cloudflare.com/ajax/libs/d3/3.5.17/d3.min.js'></script>            <script>
            window.onload = function () {
                  var layout = {
                    plot_bgcolor: 'black',
                    paper_bgcolor: 'black',
                    font: {
                        color: 'white'
                      },
                    title: {
                        text:'${spanName}',
                        
                        xref: 'paper',
                        x: 0.05,
                      },
                    showlegend: true,
                   
                    xaxis: {
                        title: {
                          text: 'Time',
                         
                        }
                    },
                    yaxis: {
                        title: {
                          text: 'Duration (milliseconds)',
                          
                        }
                    }

                  };
                  
                  Plotly.newPlot('chartContainer', ${data}, layout);
                  
                
                }
            </script>
            </head>
            <body>
            <!-- Identify where the chart should be drawn. -->
            <div id="chartContainer"></div>
            </body>

        `;

        return html;

    }
}
    