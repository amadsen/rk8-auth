(function(){
    var __eweUu__ = {};
    window.use = function use(tool){
        if( !__eweUu__[tool] ){
            throw Error("Could not find tool named "+tool);
        }
        return __eweUu__[tool];
    }
    
    use.addTool = function(tool, toolFn){
        if ("string" === typeof tool && "function" === typeof toolFn) {
            __eweUu__[tool] = toolFn;
        }
    }
})();

(function(){
    function on(eventName, handler) {
        return function(targetElement){
            targetElement.addEventListener(eventName, function(){
                handler.call(targetElement, targetElement);
            });
        }
    }
    use.addTool("on", on);
})();

(function(){    
    function parentsOf(child, selector) {
        var list = [],
            allSelected = select(selector);
        while(child && child.parentNode){
            if (allSelected.indexOf(child.parentNode)) {
                list.push(child.parentNode);
            }
            child = child.parentNode;
        }
        return list;
    }
    use.addTool("parentsOf", parentsOf);
})();

(function(){
    function select(selector, contextElement) {
        contextElement = contextElement || document;
        return [].slice.apply( contextElement.querySelectorAll(selector) );
    }
    use.addTool("select", select);
})();
    
(function(){
    var select = use("select"),
        firstScript = select('script')[0];
    return function addScript(src, onload){
        var aScript = document.createElement('script');
        aScript.onload = onload;
        aScript.src = src;
        firstScript.parentNode.insertBefore(aScript, firstScript);
    }
    use.addTool("addScript", addScript);
})();

(function(){
    function queryModel(dataStructure, query) {
        if (!query) {
            return undefined;
        }
        
        var keys = query.split(/\[|\./),
            k = keys.unshift(),
            d = dataStructure;
        while (k && d) {
            k = k.replace(/]"'/,'');
            d = d[k];
            k = keys.unshift();
        }
        return d;
    }
    use.addTool("queryModel", queryModel);
})();

(function(){
    function applyModel(dataStructure, contextElement) {
        if ("string" === typeof contextElement) {
            contextElement = select(contextElement)
        }
        
        // look for DOM nodes that should be bound to the model
        // (contextElement will default to document.)
        var toBind = select("[data-model]", contextElement),
            allChildBinds = select("[data-model] [data-model]", contextElement);
        
        toBind.filter( function(item){
            return (allChildBinds.indexOf(item) < 0);
        }).forEach( function(item){
            
        });
    }
    use.addTool("applyModel", applyModel);
})();