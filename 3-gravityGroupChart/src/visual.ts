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
            for(var j=0; j<dataValue.values[i]; j++)
            {
                ballChartDataPoints.push({
                    category: category.values[i],
                    value: dataValue.values[i],
                    color: getCategoricalObjectValue<Fill>(category, i, 'colorSelector', 'fill', defaultColor).solid.color,
                    selectionId: host.createSelectionIdBuilder()
                        .withCategory(category, i)
                        .createSelectionId()
                });
            }
        }
        dataMax = <number>dataValue.maxLocal;

        return {
            dataPoints: ballChartDataPoints,
            dataMax: dataMax,
            settings: ballChartSettings,
        };
    }

    function collide(n) {
        var r = n.radius + 100,
            nx1 = n.x - r,
            nx2 = n.x + r,
            ny1 = n.y - r,
            ny2 = n.y + r;
        return function(quad, x1, y1, x2, y2) {
            if (quad.point && (quad.point !== n)) {
            var x = n.x - quad.point.x,
                y = n.y - quad.point.y,
                l = Math.sqrt(x * x + y * y),
                r = n.radius + quad.point.radius;
            if (l < r) {
                l = (l - r) / r * 0.5;
                n.x -= x *= l;
                n.y -= y *= l;
                quad.point.x += x;
                quad.point.y += y;
            }
            }
            return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
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

            let nodes = [];
            let sel = "white";

            for(var i=0;i<viewModel.dataPoints.length;i++)
            {
                nodes[nodes.length]=viewModel.dataPoints[i];
                nodes[nodes.length-1].radius = 5;
                nodes[nodes.length-1].x = width/2;
                nodes[nodes.length-1].y = height/2;
                nodes[nodes.length-1].ox = nodes[nodes.length-1].x;
                nodes[nodes.length-1].oy = nodes[nodes.length-1].y;
                nodes[nodes.length-1].px = nodes[nodes.length-1].x*2*Math.sin(i);
                nodes[nodes.length-1].py = nodes[nodes.length-1].y*2*Math.cos(i);
            }

            let selectionManager = this.selectionManager;

            this.svg
			.on("click",function(d) { 
				sel = "white"; 
				force.resume();

                selectionManager.clear().then((ids: ISelectionId[]) => {
                        node.attr({
                            'fill-opacity': Visual.Config.solidOpacity
                        });
                    });
			});

            var node = this.svg.selectAll("circle")
                .data(nodes)
            .enter().append("circle")
                .style("fill", function(d){ return d.color; })
                .attr("r", function(d) { return d.radius; })
                .attr("cx", function(d) { return d.x; })
                .attr("cy", function(d) { return d.y; })
                .attr("class",function(d){ return "c"+ d.color.replace("#","");})
                .attr("fill-opacity", Visual.Config.solidOpacity)
                .on("click",function(d) { 
                    sel = d.color;
                    let cName = "."+ d3.select(this).attr("class");
                    node.attr("fill-opacity",Visual.Config.transparentOpacity);
                    d3.selectAll("."+ d3.select(this).attr("class")).attr("fill-opacity",Visual.Config.solidOpacity);

                    force.resume(); 

                    selectionManager.select(d.selectionId);

                    (<Event>d3.event).stopPropagation();
                });

            var force = d3.layout.force()
                .nodes(nodes)
                .size([width, height])
                .charge(-20)
                .start();
                
            force.on("tick", function(e) {
                var q = d3.geom.quadtree(nodes),
                    i = 0,
                    n = nodes.length;

                while (++i < n) q.visit(collide(nodes[i]));

                var k = 0.25 * e.alpha;
                nodes.forEach(function (d, i) {
                    d.y += ((sel == d.color ? d.oy : d.py) - d.y) * k;
                    d.x += ((sel == d.color ? d.ox : d.px) - d.x) * k;
                    force.chargeDistance(9999999999);
                });

                node
                    .attr("cx", function(d) {return d.x;})
                    .attr("cy", function(d) {return d.y;});
            });

            node.call(force.drag);
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