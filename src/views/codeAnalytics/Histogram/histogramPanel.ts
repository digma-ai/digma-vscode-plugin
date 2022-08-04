import {AnalyticsProvider, DurationRecord, PercentileDuration} from "../../../services/analyticsProvider";
import {WorkspaceState} from "../../../state";

export class HistogramPanel {



    constructor(private _analyticsProvider: AnalyticsProvider,
        private _workspaceState: WorkspaceState){

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

    private getSymbol(durationRecords: PercentileDuration[]):string{
        const text = durationRecords.map(x=>{
                if (x.isChange){
                    if (x.direction>0){
                        return `'arrow-up'`;
                    }
                    else{
                        return  `'arrow-down'`;
                    }
                }
                else{
                    return `'circle'`;
                }
            }).join(",");
        return `[${text}]`;
    }

    private getColor(durationRecords: PercentileDuration[]):string{
        const text = durationRecords.map(x=>{
                if (x.isChange){
                    if (x.direction>0){
                        return `'rgb(238,57,46)'`;
                    }
                    else{
                        return  `'rgb(102,194,165)'`;
                    }
                }
                else{
                    return `'rgb(255,255,255)'`;
                }
            }).join(",");
        return `[${text}]`;
    }

    private getSize(durationRecords: PercentileDuration[]):string{
        const text = durationRecords.map(x=>{
                if (x.isChange){
                    if (x.direction>0){
                        return `15`;
                    }
                    else{
                        return  `15`;
                    }
                }
                else{
                    return `9`;
                }
            }).join(",");
        return `[${text}]`;
    }

    public async getHtml(spanName: string, instrumentationLibrary: string,
        codeObjectId: string):Promise<string>{

        const html = await this._analyticsProvider.getHtmlGraphForSpanPercentiles(spanName, instrumentationLibrary,
            codeObjectId, this._workspaceState.environment);

        return html;
    }


    public async getHtml__OLD(spanName: string, instrumentationLibrary: string,
        codeObjectId: string):Promise<string>{

        
        const histogramData = await this._analyticsProvider.getSpanHistogramData(spanName, instrumentationLibrary,
            codeObjectId, this._workspaceState.environment);
        
        let dataByPercentile = histogramData.percentileDurations.groupBy(x=>x.percentile);
        let percentiles = Object.keys(dataByPercentile);
        let dataSources: string[] = [];

        for (const percentile of percentiles){
            let p = parseFloat(percentile);
            let percentileData = dataByPercentile[p];

            const xValues = this.getXAxisData(percentileData);
            const yValues = this.getYAxisData(percentileData);
    
            const icons = this.getSymbol(percentileData);

            const colors = this.getColor(percentileData);

            const size = this.getSize(percentileData);

            dataSources.push(`
                    {
                        type: "scatter",
                        name: 'P${(p*100).toString()}',
                        x: ${xValues},
                        y: ${yValues},
                        marker : {
                            color: ${colors},
                            symbol: ${icons},
                            size: ${size}
                        }
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
    