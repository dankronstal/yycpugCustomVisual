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
var powerbi;
(function (powerbi) {
    var extensibility;
    (function (extensibility) {
        var visual;
        (function (visual) {
            var PBI_CV_820a1803_8e00_4869_b083_b47eeec8aff2;
            (function (PBI_CV_820a1803_8e00_4869_b083_b47eeec8aff2) {
                ;
                ;
                /**
                 * Function that converts queried data into a view model that will be used by the visual.
                 *
                 * @function
                 * @param {VisualUpdateOptions} options - Contains references to the size of the container
                 *                                        and the dataView which contains all the data
                 *                                        the visual had queried.
                 * @param {IVisualHost} host            - Contains references to the host which contains services
                 */
                function visualTransform(options, host) {
                    var dataViews = options.dataViews;
                    var defaultSettings = {
                        enableAxis: {
                            show: false,
                        },
                        rScale: null
                    };
                    var viewModel = {
                        dataPoints: [],
                        dataPointTooltips: [],
                        dataMax: 0,
                        dataMin: 0,
                        settings: {}
                    };
                    if (!dataViews
                        || !dataViews[0]
                        || !dataViews[0].categorical
                        || !dataViews[0].categorical.categories[0]
                        || !dataViews[0].categorical.values[0])
                        return viewModel;
                    var categorical = dataViews[0].categorical;
                    var categories = categorical.categories;
                    var values = categorical.values;
                    var ballChartDataPoints = [];
                    var ballChartDataPointTts = [];
                    var dataMax = 0;
                    var dataMin = 99999;
                    var colorPalette = PBI_CV_820a1803_8e00_4869_b083_b47eeec8aff2.createColorPalette(host.colors).reset();
                    var objects = dataViews[0].metadata.objects;
                    var ballChartSettings = {
                        enableAxis: {
                            show: PBI_CV_820a1803_8e00_4869_b083_b47eeec8aff2.getValue(objects, 'enableAxis', 'show', defaultSettings.enableAxis.show),
                        },
                        rScale: null
                    };
                    for (var i = 0, lenV = values.length; i < lenV; i++) {
                        for (var j = 0, lenC = categories[0].values.length; j < lenC; j++) {
                            var defaultColor = {
                                solid: {
                                    color: colorPalette.getColor(categories[0].values[j]).value
                                }
                            };
                            var c = categories[0].values[j] == null ? "null" : categories[0].values[j];
                            var v = values[i].values[j] == null ? 0 : values[i].values[j];
                            ballChartDataPoints.push({
                                category: c,
                                value: v,
                                color: PBI_CV_820a1803_8e00_4869_b083_b47eeec8aff2.getCategoricalObjectValue(c, j, 'colorSelector', 'fill', defaultColor).solid.color,
                                selectionId: host.createSelectionIdBuilder()
                                    .withCategory(categorical.categories[0], j)
                                    .createSelectionId()
                            });
                            dataMax = v > dataMax ? v : dataMax;
                            dataMin = v < dataMin && v > 0 ? v : dataMin;
                            if (Date.parse(values[i].source.groupName) > 0)
                                ballChartDataPointTts.push(c + " brought a bottle worth $" + v + " on " + new Date(values[i].source.groupName).toLocaleDateString());
                            else
                                ballChartDataPointTts.push("Category = " + c + "; Measure = " + v + "; Series = " + values[i].source.groupName);
                        }
                    }
                    ballChartSettings.rScale = d3.scale.linear().domain([dataMin, dataMax]).range([5, 20]);
                    return {
                        dataPoints: ballChartDataPoints,
                        dataPointTooltips: ballChartDataPointTts,
                        dataMax: dataMax,
                        dataMin: dataMin,
                        settings: ballChartSettings,
                    };
                }
                function collide(n) {
                    var r = n.radius + 100, nx1 = n.x - r, nx2 = n.x + r, ny1 = n.y - r, ny2 = n.y + r;
                    return function (quad, x1, y1, x2, y2) {
                        if (quad.point && (quad.point !== n)) {
                            var x = n.x - quad.point.x, y = n.y - quad.point.y, l = Math.sqrt(x * x + y * y), r = n.radius + quad.point.radius;
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
                var Visual = (function () {
                    /**
                     * Creates instance of ballChart. This method is only called once.
                     *
                     * @constructor
                     * @param {VisualConstructorOptions} options - Contains references to the element that will
                     *                                             contain the visual and a reference to the host
                     *                                             which contains services.
                     */
                    function Visual(options) {
                        this.host = options.host;
                        this.selectionManager = options.host.createSelectionManager();
                        var svg = this.svg = d3.select(options.element)
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
                    Visual.prototype.update = function (options) {
                        var viewModel = visualTransform(options, this.host);
                        var settings = this.ballChartSettings = viewModel.settings;
                        this.ballDataPoints = viewModel.dataPoints;
                        var width = options.viewport.width;
                        var height = options.viewport.height;
                        this.svg.attr({
                            width: width,
                            height: height
                        });
                        if (settings.enableAxis.show) {
                            var margins = Visual.Config.margins;
                            height -= margins.bottom;
                        }
                        this.xAxis.style({
                            'font-size': d3.min([height, width]) * Visual.Config.xAxisFontMultiplier,
                        });
                        var yScale = d3.scale.linear()
                            .domain([0, viewModel.dataMax])
                            .range([height, 0]);
                        var xScale = d3.scale.ordinal()
                            .domain(viewModel.dataPoints.map(function (d) { return d.category; }))
                            .rangeRoundBands([0, width], Visual.Config.xScalePadding, 0.2);
                        var xAxis = d3.svg.axis()
                            .scale(xScale)
                            .orient('bottom');
                        this.xAxis.attr('transform', 'translate(0, ' + height + ')')
                            .call(xAxis);
                        var nodes = [];
                        var sel = "white";
                        for (var i = 0; i < viewModel.dataPoints.length; i++) {
                            if (viewModel.dataPoints[i].value == 0)
                                continue;
                            nodes[nodes.length] = viewModel.dataPoints[i];
                            nodes[nodes.length - 1].radius = viewModel.settings.rScale(nodes[nodes.length - 1].value);
                            nodes[nodes.length - 1].x = width / 2;
                            nodes[nodes.length - 1].y = height / 2;
                            nodes[nodes.length - 1].ox = nodes[nodes.length - 1].x;
                            nodes[nodes.length - 1].oy = nodes[nodes.length - 1].y;
                            nodes[nodes.length - 1].px = nodes[nodes.length - 1].x * 2 * Math.sin(i);
                            nodes[nodes.length - 1].py = nodes[nodes.length - 1].y * 2 * Math.cos(i);
                            nodes[nodes.length - 1].tooltip = viewModel.dataPointTooltips[i];
                        }
                        var selectionManager = this.selectionManager;
                        this.svg
                            .on("click", function (d) {
                            sel = "white";
                            force.resume();
                            selectionManager.clear().then(function (ids) {
                                node.attr({
                                    'fill-opacity': Visual.Config.solidOpacity
                                });
                            });
                        });
                        var node = this.svg.selectAll("g")
                            .data(nodes)
                            .enter().append("g")
                            .attr("class", function (d) { return "c" + d.color.replace("#", ""); })
                            .attr("fill-opacity", Visual.Config.solidOpacity)
                            .on("click", function (d) {
                            sel = d.color;
                            node.attr("fill-opacity", Visual.Config.transparentOpacity);
                            d3.selectAll("." + d3.select(this).attr("class")).attr("fill-opacity", Visual.Config.solidOpacity);
                            force.resume();
                            selectionManager.select(d.selectionId);
                            d3.event.stopPropagation();
                        });
                        this.svg.selectAll("g")
                            .data(nodes).exit().remove();
                        node.append("svg:title").text(function (d) { return d.tooltip; });
                        var nodeCircles = node.append("circle")
                            .style("fill", function (d) { return d.color; })
                            .attr("r", function (d) { return d.radius; })
                            .attr("cx", function (d) { return d.x; })
                            .attr("cy", function (d) { return d.y; });
                        var force = d3.layout.force()
                            .nodes(nodes)
                            .size([width, height])
                            .charge(-25)
                            .start();
                        force.on("tick", function (e) {
                            var q = d3.geom.quadtree(nodes), i = 0, n = nodes.length;
                            while (++i < n)
                                q.visit(collide(nodes[i]));
                            var k = 0.25 * e.alpha;
                            nodes.forEach(function (d, i) {
                                d.y += ((sel == d.color ? d.oy : d.py) - d.y) * k;
                                d.x += ((sel == d.color ? d.ox : d.px) - d.x) * k;
                                force.chargeDistance(9999999999);
                            });
                            nodeCircles
                                .attr("cx", function (d) { return d.x; })
                                .attr("cy", function (d) { return d.y; });
                        });
                        node.call(force.drag);
                    };
                    /**
                     * Enumerates through the objects defined in the capabilities and adds the properties to the format pane
                     *
                     * @function
                     * @param {EnumerateVisualObjectInstancesOptions} options - Map of defined objects
                     */
                    Visual.prototype.enumerateObjectInstances = function (options) {
                        var objectName = options.objectName;
                        var objectEnumeration = [];
                        switch (objectName) {
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
                                for (var _i = 0, _a = this.ballDataPoints; _i < _a.length; _i++) {
                                    var ballDataPoint = _a[_i];
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
                        }
                        ;
                        return objectEnumeration;
                    };
                    /**
                     * Destroy runs when the visual is removed. Any cleanup that the visual needs to
                     * do should be done here.
                     *
                     * @function
                     */
                    Visual.prototype.destroy = function () {
                        //Perform any cleanup tasks here
                    };
                    Visual.Config = {
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
                    return Visual;
                }());
                PBI_CV_820a1803_8e00_4869_b083_b47eeec8aff2.Visual = Visual;
            })(PBI_CV_820a1803_8e00_4869_b083_b47eeec8aff2 = visual.PBI_CV_820a1803_8e00_4869_b083_b47eeec8aff2 || (visual.PBI_CV_820a1803_8e00_4869_b083_b47eeec8aff2 = {}));
        })(visual = extensibility.visual || (extensibility.visual = {}));
    })(extensibility = powerbi.extensibility || (powerbi.extensibility = {}));
})(powerbi || (powerbi = {}));
var powerbi;
(function (powerbi) {
    var extensibility;
    (function (extensibility) {
        var visual;
        (function (visual) {
            var PBI_CV_820a1803_8e00_4869_b083_b47eeec8aff2;
            (function (PBI_CV_820a1803_8e00_4869_b083_b47eeec8aff2) {
                /**
                 * Singleton reference of ColorPalette.
                 *
                 * @instance
                 */
                var colorManager;
                /**
                 * Factory method for creating a ColorPalette.
                 *
                 * @function
                 * @param {IColorInfo[]} colors - Array of ColorInfo objects that contain
                 *                                hex values for colors.
                 */
                function createColorPalette(colors) {
                    if (!colorManager)
                        colorManager = new ColorPalette(colors);
                    return colorManager;
                }
                PBI_CV_820a1803_8e00_4869_b083_b47eeec8aff2.createColorPalette = createColorPalette;
                var ColorPalette = (function () {
                    function ColorPalette(colors) {
                        this.colorPalette = {};
                        this.colorIndex = 0;
                        this.colors = colors;
                    }
                    /**
                     * Gets color from colorPalette and returns an IColorInfo
                     *
                     * @function
                     * @param {string} key - Key of assign color in colorPalette.
                     */
                    ColorPalette.prototype.getColor = function (key) {
                        var color = this.colorPalette[key];
                        if (color) {
                            return color;
                        }
                        var colors = this.colors;
                        color = this.colorPalette[key] = colors[this.colorIndex++];
                        if (this.colorIndex >= colors.length) {
                            this.colorIndex = 0;
                        }
                        return color;
                    };
                    /**
                     * resets colorIndex to 0
                     *
                     * @function
                     */
                    ColorPalette.prototype.reset = function () {
                        this.colorIndex = 0;
                        return this;
                    };
                    /**
                     * Clears colorPalette of cached keys and colors
                     *
                     * @function
                     */
                    ColorPalette.prototype.clear = function () {
                        this.colorPalette = {};
                    };
                    return ColorPalette;
                }());
            })(PBI_CV_820a1803_8e00_4869_b083_b47eeec8aff2 = visual.PBI_CV_820a1803_8e00_4869_b083_b47eeec8aff2 || (visual.PBI_CV_820a1803_8e00_4869_b083_b47eeec8aff2 = {}));
        })(visual = extensibility.visual || (extensibility.visual = {}));
    })(extensibility = powerbi.extensibility || (powerbi.extensibility = {}));
})(powerbi || (powerbi = {}));
var powerbi;
(function (powerbi) {
    var extensibility;
    (function (extensibility) {
        var visual;
        (function (visual) {
            var PBI_CV_820a1803_8e00_4869_b083_b47eeec8aff2;
            (function (PBI_CV_820a1803_8e00_4869_b083_b47eeec8aff2) {
                /**
                 * Gets property value for a particular object.
                 *
                 * @function
                 * @param {DataViewObjects} objects - Map of defined objects.
                 * @param {string} objectName       - Name of desired object.
                 * @param {string} propertyName     - Name of desired property.
                 * @param {T} defaultValue          - Default value of desired property.
                 */
                function getValue(objects, objectName, propertyName, defaultValue) {
                    if (objects) {
                        var object = objects[objectName];
                        if (object) {
                            var property = object[propertyName];
                            if (property !== undefined) {
                                return property;
                            }
                        }
                    }
                    return defaultValue;
                }
                PBI_CV_820a1803_8e00_4869_b083_b47eeec8aff2.getValue = getValue;
                /**
                 * Gets property value for a particular object in a category.
                 *
                 * @function
                 * @param {DataViewCategoryColumn} category - List of category objects.
                 * @param {number} index                    - Index of category object.
                 * @param {string} objectName               - Name of desired object.
                 * @param {string} propertyName             - Name of desired property.
                 * @param {T} defaultValue                  - Default value of desired property.
                 */
                function getCategoricalObjectValue(category, index, objectName, propertyName, defaultValue) {
                    var categoryObjects = category.objects;
                    if (categoryObjects) {
                        var categoryObject = categoryObjects[index];
                        if (categoryObject) {
                            var object = categoryObject[objectName];
                            if (object) {
                                var property = object[propertyName];
                                if (property !== undefined) {
                                    return property;
                                }
                            }
                        }
                    }
                    return defaultValue;
                }
                PBI_CV_820a1803_8e00_4869_b083_b47eeec8aff2.getCategoricalObjectValue = getCategoricalObjectValue;
            })(PBI_CV_820a1803_8e00_4869_b083_b47eeec8aff2 = visual.PBI_CV_820a1803_8e00_4869_b083_b47eeec8aff2 || (visual.PBI_CV_820a1803_8e00_4869_b083_b47eeec8aff2 = {}));
        })(visual = extensibility.visual || (extensibility.visual = {}));
    })(extensibility = powerbi.extensibility || (powerbi.extensibility = {}));
})(powerbi || (powerbi = {}));
var powerbi;
(function (powerbi) {
    var visuals;
    (function (visuals) {
        var plugins;
        (function (plugins) {
            plugins.PBI_CV_820a1803_8e00_4869_b083_b47eeec8aff2_DEBUG = {
                name: 'PBI_CV_820a1803_8e00_4869_b083_b47eeec8aff2_DEBUG',
                displayName: 'BarChartSampleModified3',
                class: 'Visual',
                version: '1.0.0',
                apiVersion: '1.1.0',
                create: function (options) { return new powerbi.extensibility.visual.PBI_CV_820a1803_8e00_4869_b083_b47eeec8aff2.Visual(options); },
                custom: true
            };
        })(plugins = visuals.plugins || (visuals.plugins = {}));
    })(visuals = powerbi.visuals || (powerbi.visuals = {}));
})(powerbi || (powerbi = {}));
//# sourceMappingURL=visual.js.map