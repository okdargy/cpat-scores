
import { colord, extend } from "colord"
import namesPlugin from "colord/plugins/names"
import React, { useEffect, useMemo, useRef } from "react"
import { RgbStringColorPicker } from "react-colorful"

extend([namesPlugin])

type ColorPickerProps = {
  color: string
  onChange: (color: string) => void
}

const CustomPicker: React.FC<{ color: string; onChange: (color: string) => void }> = ({ color, ...rest }) => {
  const rgbaString = useMemo(() => {
    return color?.startsWith("rgba") ? color : colord(color).toRgbString()
  }, [color])

  return <RgbStringColorPicker color={rgbaString} {...rest} />
}

export const ColorPicker: React.FC<ColorPickerProps> = (props) => {
  const [visible, setVisible] = React.useState(false)
  const [color, setColor] = React.useState(props.color)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setColor(props.color)
  }, [props.color])

  useEffect(() => {
    if (!ref.current) {
      return
    }
    const handleClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setVisible(false)
      }
    }

    document.addEventListener("click", handleClick)

    return () => {
      document.removeEventListener("click", handleClick)
    }
  }, [])

  return (
    <div
      ref={ref}
      className="relative w-6 h-6 rounded-full cursor-pointer flex-shrink-0 my-auto"
      style={{ backgroundColor: color }}
      onClick={() => {
        setVisible(true)
      }}>
      {visible && (
        <div className="absolute top-0 right-[-210px] z-10">
          <CustomPicker
            color={props.color}
            onChange={(color) => {
              setColor(color)
              if (props.onChange) {
                props.onChange(color)
              }
            }}
          />
        </div>
      )}
    </div>
  )
}