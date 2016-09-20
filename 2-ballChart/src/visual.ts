/*
 *  Power BI Visual CLI
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

module powerbi.extensibility.visual {
    
    /**
     * Interface for ballCharts viewmodel.
     *
     * @interface
     * @property {ballChartDataPoint[]} dataPoints - Set of data points the visual will render.
     * @property {number} dataMax                 - Maximum data value in the set of data points.
     */
    interface ballChartViewModel {
        dataPoints: ballChartDataPoint[];
        dataMax: number;
        settings: ballChartSettings;
    };

    /**
     * Interface for ballChart data points.
     *
     * @interface
     * @property {number} value    - Data value for point.
     * @property {string} category - Coresponding category of data value.
     */
    interface ballChartDataPoint {
        value: number;
        category: string;
        color: string;
        selectionId: ISelectionId;
    };
    
    /**
     * Interface for ballChart settings.
     *
     * @interface
     * @property {{show:boolean}} enableAxis - Object property that allows axis to be enabled.
     */
    interface ballChartSettings {
        enableAxis: {
            show: boolean;
        };
    }
    
    /**
     * Function that converts queried data into a view model that will be used by the visual.
     *
     * @function
     * @param {VisualUpdateOptions} options - Contains references to the size of the container
     *                                        and the dataView which contains all the data
     *                                        the visual had queried.
     * @param {IVisualHost} host            - Contains references to the host which contains services
     */
    function visualTransform(options: VisualUpdateOptions, host: IVisualHost): ballChartViewModel {
        let dataViews = options.dataViews;
        let defaultSettings: ballChartSettings = {
            enableAxis: {
                show: false,
            }
        };
        let viewModel: ballChartViewModel = {
            dataPoints: [],
            dataMax: 0,
            settings: <ballChartSettings>{}
        };

        if (!dataViews
            || !dataViews[0]
            || !dataViews[0].categorical
            || !dataViews[0].categorical.categories
            || !dataViews[0].categorical.categories[0].source
            || !dataViews[0].categorical.values)
            return viewModel;

        let categorical = dataViews[0].categorical;
        let category = categorical.categories[0];
        let dataValue = categorical.values[0];

        let ballChartDataPoints: ballChartDataPoint[] = [];
        let dataMax: number;

        let colorPalette: IColorPalette = createColorPalette(host.colors).reset();
        let objects = dataViews[0].metadata.objects;
        let ballChartSettings: ballChartSettings = {
            enableAxis: {
                show: getValue<boolean>(objects, 'enableAxis', 'show', defaultSettings.enableAxis.show),
            }
        }
        for (let i = 0, len = Math.max(category.values.length, dataValue.values.length); i < len; i++) {
            let defaultColor: Fill = {
                solid: {
                    color: colorPalette.getColor(category.values[i]).value
                }
            }

            ballChartDataPoints.push({
                category: category.values[i],
                value: dataValue.values[i],
                color: getCategoricalObjectValue<Fill>(category, i, 'colorSelector', 'fill', defaultColor).solid.color,
                selectionId: host.createSelectionIdBuilder()
                    .withCategory(category, i)
                    .createSelectionId()
            });
        }
        dataMax = <number>dataValue.maxLocal;

        return {
            dataPoints: ballChartDataPoints,
            dataMax: dataMax,
            settings: ballChartSettings,
        };
    }
        
    export class Visual implements IVisual {
        private svg: d3.Selection<SVGElement>;
        private host: IVisualHost;
        private selectionManager: ISelectionManager;
        private ballChartContainer: d3.Selection<SVGElement>;
        private ballContainer: d3.Selection<SVGElement>;
        private xAxis: d3.Selection<SVGElement>;
        private ballDataPoints: ballChartDataPoint[];
        private ballChartSettings: ballChartSettings;

        static Config = {
            xScalePadding: 0.1,
            solidOpacity: 1,
            transparentOpacity: 0.5,
            margins: {
                top: 0,
                right: 0,
                bottom: 25,
                left: 30,
            },
            xAxisFontMultiplier: 0.04,
        };

        /**
         * Creates instance of ballChart. This method is only called once.
         *
         * @constructor
         * @param {VisualConstructorOptions} options - Contains references to the element that will
         *                                             contain the visual and a reference to the host
         *                                             which contains services.
         */
        constructor(options: VisualConstructorOptions) {
            this.host = options.host;
            this.selectionManager = options.host.createSelectionManager();
            let svg = this.svg = d3.select(options.element)
                .append('svg')
                .classed('ballChart', true);

            this.ballContainer = svg.append('g')
                .classed('ballContainer', true);

            this.xAxis = svg.append('g')
                .classed('xAxis', true);
        }

        /**
         * Updates the state of the visual. Every sequential databinding and resize will call update.
         *
         * @function
         * @param {VisualUpdateOptions} options - Contains references to the size of the container
         *                                        and the dataView which contains all the data
         *                                        the visual had queried.
         */
        public update(options: VisualUpdateOptions) {
            let viewModel: ballChartViewModel = visualTransform(options, this.host);
            let settings = this.ballChartSettings = viewModel.settings;
            this.ballDataPoints = viewModel.dataPoints;

            let width = options.viewport.width;
            let height = options.viewport.height;

            this.svg.attr({
                width: width,
                height: height
            });

            if(settings.enableAxis.show) {
                let margins = Visual.Config.margins;
                height -= margins.bottom;
            }

            this.xAxis.style({
                'font-size': d3.min([height, width]) * Visual.Config.xAxisFontMultiplier,
            });

            let yScale = d3.scale.linear()
                .domain([0, viewModel.dataMax])
                .range([height, 0]);

            let xScale = d3.scale.ordinal()
                .domain(viewModel.dataPoints.map(d => d.category))
                .rangeRoundBands([0, width], Visual.Config.xScalePadding, 0.2);

            let xAxis = d3.svg.axis()
                .scale(xScale)
                .orient('bottom');

            this.xAxis.attr('transform', 'translate(0, ' + height + ')')
                .call(xAxis);

            let ball = this.ballContainer.selectAll('.ball').data(viewModel.dataPoints);
            ball.enter()
                .append('circle')
                .classed('ball', true);

            ball.attr({
                cy: d => 200,
                cx: d => 100+xScale(d.category),
                r: d => (height - yScale(d.value))/4,
                fill: d => d.color,
                'fill-opacity': Visual.Config.solidOpacity,
            });

            let selectionManager = this.selectionManager;

            //This must be an anonymous function instead of a lambda because
            //d3 uses 'this' as the reference to the element that was clicked.
            ball.on('click', function(d) {
                selectionManager.select(d.selectionId).then((ids: ISelectionId[]) => {
                    ball.attr({
                        'fill-opacity': ids.length > 0 ? Visual.Config.transparentOpacity : Visual.Config.solidOpacity
                    });

                    d3.select(this).attr({
                        'fill-opacity': Visual.Config.solidOpacity
                    });
                });

                (<Event>d3.event).stopPropagation();
            });

            ball.exit()
               .remove();
        }

        /**
         * Enumerates through the objects defined in the capabilities and adds the properties to the format pane
         *
         * @function
         * @param {EnumerateVisualObjectInstancesOptions} options - Map of defined objects
         */
        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
            let objectName = options.objectName;
            let objectEnumeration: VisualObjectInstance[] = [];

            switch(objectName) {
                case 'enableAxis':
                    objectEnumeration.push({
                        objectName: objectName,
                        properties: {
                            show: this.ballChartSettings.enableAxis.show,
                        },
                        selector: null
                    });
                    break;
                case 'colorSelector':
                    for(let ballDataPoint of this.ballDataPoints) {
                        objectEnumeration.push({
                            objectName: objectName,
                            displayName: ballDataPoint.category,
                            properties: {
                                fill: {
                                    solid: {
                                        color: ballDataPoint.color
                                    }
                                }
                            },
                            selector: ballDataPoint.selectionId.getSelector()
                        });
                    }
                    break;
            };

            return objectEnumeration;
        }

        /**
         * Destroy runs when the visual is removed. Any cleanup that the visual needs to
         * do should be done here.
         *
         * @function
         */
        public destroy(): void {
            //Perform any cleanup tasks here
        }
    }
}